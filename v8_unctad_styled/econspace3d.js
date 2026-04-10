/**
 * EconSpace 3D v2  ─  Flow Space
 * ============================================================
 * 経済空間 3D 可視化モード（STATE.metric === 'econspace'）。
 *
 * 初期状態（2.5D）:
 *   各国ノードは netBalance に基づいて X 軸上（Y=0, Z=0）に配置。
 *   正のバランス（輸出超過）は右、負（輸入超過）は左。
 *
 * 「Start Flow」ボタンで以下が同時進行:
 *   1. ノードが econospace 座標へアニメーション移動
 *      X=log(輸出額), Y=平均単価($/kg), Z=log(輸入額)
 *   2. 貿易フロー パーティクルが輸出国 → 輸入国へ飛翔
 *   3. Y 軸シフト: 輸出超過国は上昇 (+Y)、輸入超過国は下降 (-Y)
 *
 * 「Reset」で 2.5D 初期状態に戻す。
 *
 * Three.js r134（グローバル名前空間）依存。
 */

(function () {
    'use strict';

    /* ── 依存チェック ─────────────────────────────────────────────── */
    const TM = window.TradeMap;
    if (!TM || !window.THREE) {
        console.error('[EconSpace3D] TradeMap または THREE が見つかりません。');
        return;
    }

    // ─── モジュールレベルのアニメーション状態 ──────────────────────────
    //   uniforms オブジェクトは onBeforeCompile で GPU シェーダーに渡す参照。
    //   外部から .value を更新するだけで GPU ユニフォームが即時反映される。
    const _econNodeUniforms = {
        placementT: { value: 0.0 },   // 0=2.5D初期位置, 1=econspace配置完了
        flowT:      { value: 0.0 },   // 0=Yシフト無し, 1=最大Yシフト
    };
    let _econParticleUniforms = null; // { time: { value: 0 } } — _econBuildFlowsで設定

    let _econAnimState   = 'idle';    // 'idle' | 'flowing' | 'done'
    let _econFlowStart   = 0;         // flow開始時の performance.now()
    let _econNodeEntries = [];        // hitMesh位置更新用エントリ [{hitMesh, startCenter, targetCenter, yShiftDir}]

    const PLACEMENT_DUR = 2.5;       // 秒: ノードがeconspaceへ移動するアニメーション時間
    const YSHIFT_DELAY  = 2.0;       // 秒: Yシフト開始タイミング (placement完了に近いタイミング)
    const YSHIFT_DUR    = 1.8;       // 秒: Yシフト完了までの時間
    const Y_SHIFT_WU    = 55.0;      // world units: 輸出国の上昇 / 輸入国の下降量

    // ═══════════════════════════════════════════════════════════════════
    // 1. データ集計
    //    STATE.data から年・地域フィルタ後に国別集計値を計算する。
    // ═══════════════════════════════════════════════════════════════════
    TM._econComputeStats = function () {
        let yearData = STATE.data.filter(d => d.year === STATE.year && d.value > 0);

        if (STATE.region && STATE.region !== 'Global') {
            yearData = yearData.filter(d => {
                const expR = RegionConfig.getRegion(d.exporter);
                const impR = RegionConfig.getRegion(d.importer);
                return expR === STATE.region || impR === STATE.region;
            });
        }

        const stats = {};
        yearData.forEach(d => {
            if (d.exporter === '_X' || d.importer === '_X') return;

            if (!stats[d.exporter]) {
                stats[d.exporter] = { iso: d.exporter, totalExport: 0, totalImport: 0, partners: new Set() };
            }
            stats[d.exporter].totalExport += d.value;
            stats[d.exporter].partners.add(d.importer);

            if (!stats[d.importer]) {
                stats[d.importer] = { iso: d.importer, totalExport: 0, totalImport: 0, partners: new Set() };
            }
            stats[d.importer].totalImport += d.value;
            stats[d.importer].partners.add(d.exporter);
        });

        Object.values(stats).forEach(s => {
            s.uniquePartners = s.partners.size;
            delete s.partners;
            s.netBalance   = s.totalExport - s.totalImport;
            const total    = s.totalExport + s.totalImport;
            s.balanceRatio = total > 0 ? s.netBalance / total : 0;
        });

        return stats;
    };

    // ═══════════════════════════════════════════════════════════════════
    // 2. ワールド座標スケールの構築
    //    mapNetBalance を追加: netBalance → X軸初期位置（線形スケール）
    // ═══════════════════════════════════════════════════════════════════
    TM._econBuildScales = function (stats) {
        const vals  = Object.values(stats);
        const SPACE = 460;
        const Y_MAX = 240;

        // X軸: Gross trade (Export + Import) — IHS (inverse hyperbolic sine) 変換
        const grossVals = vals.map(s => s.totalExport + s.totalImport).filter(v => v > 0);
        const ihsMin    = Math.asinh(d3.min(grossVals) || 1e4);
        const ihsMax    = Math.asinh(d3.max(grossVals) || 1e12);
        const ihsRange  = Math.max(ihsMax - ihsMin, 1e-9);
        const mapGross  = g => {
            if (!g || g <= 0) return -SPACE;
            const t = Math.max(0, Math.min(1, (Math.asinh(g) - ihsMin) / ihsRange));
            return t * SPACE * 2 - SPACE;
        };

        // Z軸: Net Ratio (balanceRatio) — 中央値 K を用いたラプラス平滑化シュリンケージ
        const netRatios    = vals.map(s => s.balanceRatio);
        const medianK      = d3.median(netRatios) || 0;
        const LAMBDA       = 0.3;
        const shrink       = r => (r + medianK * LAMBDA) / (1 + LAMBDA);
        const shrunkRatios = vals.map(s => shrink(s.balanceRatio));
        const shrunkMin    = d3.min(shrunkRatios) || -1;
        const shrunkMax    = d3.max(shrunkRatios) || 1;
        const shrunkRange  = Math.max(shrunkMax - shrunkMin, 1e-9);
        const mapNetRatio  = r => {
            const sr = shrink(r);
            const t  = Math.max(0, Math.min(1, (sr - shrunkMin) / shrunkRange));
            return t * SPACE * 2 - SPACE;
        };

        // Y軸: 取引相手国数（ネットワーク中心性）
        const partnerCounts  = vals.map(s => s.uniquePartners);
        const maxPartners    = d3.max(partnerCounts) || 1;
        const medianPartners = d3.median(partnerCounts) || 0;

        // 初期 X 配置: Net Balance → 線形スケール（2.5D レイアウト用）
        const netBals       = vals.map(s => s.netBalance);
        const nbAbsMax      = Math.max(Math.abs(d3.min(netBals) || 1), Math.abs(d3.max(netBals) || 1));
        const NB_RANGE      = SPACE * 0.78;
        const mapNetBalance = nb => (nb / nbAbsMax) * NB_RANGE;

        // ノード半径: Gross trade の対数スケール
        const logMin = Math.log10(Math.max(d3.min(grossVals) || 1e4, 1e4));
        const logMax = Math.log10(Math.max(d3.max(grossVals) || 1e12, 1e6));
        const logRange = Math.max(logMax - logMin, 1e-9);

        return {
            SPACE, Y_MAX,
            maxPartners, medianPartners,
            mapGross,
            mapNetRatio,
            mapNetBalance,
            mapY:         s  => (s.uniquePartners / maxPartners) * Y_MAX,
            mapPartners:  p  => (p / maxPartners) * Y_MAX,
            mapSaturation: () => 1.0,
            nodeRadius:   s  => {
                const gross = s.totalExport + s.totalImport;
                if (!gross || gross <= 0) return 5;
                const t = Math.max(0, Math.min(1,
                    (Math.log10(Math.max(gross, 1)) - logMin) / logRange
                ));
                return 5 + t * 25;
            },
        };
    };

    // ═══════════════════════════════════════════════════════════════════
    // 3. econospace ワールド座標取得（target 座標）
    // ═══════════════════════════════════════════════════════════════════
    TM._econWorldPos = function (iso, stats, sc) {
        const s = stats[iso];
        if (!s) return null;
        if (s.totalExport <= 0 && s.totalImport <= 0) return null;
        return new THREE.Vector3(
            sc.mapGross(s.totalExport + s.totalImport),
            sc.mapY(s),
            sc.mapNetRatio(s.balanceRatio)
        );
    };

    // ═══════════════════════════════════════════════════════════════════
    // 4. 動的グループのクリーンアップ
    // ═══════════════════════════════════════════════════════════════════
    TM._econClearDynamic = function () {
        const { scene } = this._3d;

        if (this._3d.econDataGroup) {
            scene.remove(this._3d.econDataGroup);
            this._3d.econDataGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
            this._3d.econDataGroup = null;
        }

        ['econ-label-overlay', 'econ-axis-overlay'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });

        this._econUpdateLabels = null;
    };

    // ═══════════════════════════════════════════════════════════════════
    // 5. 静的シーン（グリッド・対角線・軸線・Y参照平面）
    // ═══════════════════════════════════════════════════════════════════
    TM._econBuildStaticScene = function (sc) {
        const { scene } = this._3d;
        const S  = sc.SPACE;
        const SZ = S * 0.7;   // Z 方向の半深度
        const YM = sc.Y_MAX;

        if (this._3d.econStaticGroup) {
            scene.remove(this._3d.econStaticGroup);
            this._3d.econStaticGroup.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
        }

        const sg = new THREE.Group();
        this._3d.econStaticGroup = sg;
        scene.add(sg);

        // ── 3面の半透明パネル ─────────────────────────────────────────────
        const makePanelMat = () => new THREE.MeshBasicMaterial({
            color: 0x111827, transparent: true, opacity: 0.35,
            side: THREE.DoubleSide, depthWrite: false,
        });

        // 1. 床面 (Y=0, XZ平面)
        {
            const v = new Float32Array([
                -S, 0, -SZ,   S, 0, -SZ,   S, 0,  SZ,
                -S, 0, -SZ,   S, 0,  SZ,  -S, 0,  SZ,
            ]);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
            sg.add(new THREE.Mesh(geo, makePanelMat()));
        }

        // 2. 奥壁面 (Z=-SZ, XY平面)
        {
            const v = new Float32Array([
                -S, 0,  -SZ,   S, 0,  -SZ,   S, YM, -SZ,
                -S, 0,  -SZ,   S, YM, -SZ,  -S, YM, -SZ,
            ]);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
            sg.add(new THREE.Mesh(geo, makePanelMat()));
        }

        // 3. 左壁面 (X=-S, YZ平面)
        {
            const v = new Float32Array([
                -S, 0,  -SZ,  -S, 0,   SZ,  -S, YM,  SZ,
                -S, 0,  -SZ,  -S, YM,  SZ,  -S, YM, -SZ,
            ]);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
            sg.add(new THREE.Mesh(geo, makePanelMat()));
        }

        // ── グリッド線 ──────────────────────────────────────────────────────
        const zLevels = [-SZ, -SZ * 0.5, 0, SZ * 0.5, SZ];
        const xLevels = [-S, 0, S];
        const partnerTicks = [50, 100, 150, 200];
        const medP = sc.medianPartners || 0;

        const makeLines = (pts, mat) => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pts), 3));
            sg.add(new THREE.LineSegments(geo, mat));
        };

        const gridMat  = () => new THREE.LineBasicMaterial({ color: 0x374151, transparent: true, opacity: 0.75 });
        const whiteMat = () => new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.90 });

        // 床面グリッド (Y=0)
        {
            const pts = [];
            zLevels.forEach(z => { if (z !== 0) pts.push(-S, 0, z, S, 0, z); });
            xLevels.forEach(x => pts.push(x, 0, -SZ, x, 0, SZ));
            makeLines(pts, gridMat());
            // Z=0 白強調
            makeLines([-S, 0, 0, S, 0, 0], whiteMat());
        }

        // 奥壁面グリッド (Z=-SZ)
        {
            const pts = [];
            xLevels.forEach(x => pts.push(x, 0, -SZ, x, YM, -SZ));
            partnerTicks.forEach(p => {
                const y = sc.mapPartners(p);
                if (y > 0 && y <= YM) pts.push(-S, y, -SZ, S, y, -SZ);
            });
            if (medP > 0) {
                const y = sc.mapPartners(medP);
                if (y > 0 && y <= YM) pts.push(-S, y, -SZ, S, y, -SZ);
            }
            makeLines(pts, gridMat());
        }

        // 左壁面グリッド (X=-S)
        {
            const pts = [];
            zLevels.forEach(z => { if (z !== 0) pts.push(-S, 0, z, -S, YM, z); });
            partnerTicks.forEach(p => {
                const y = sc.mapPartners(p);
                if (y > 0 && y <= YM) pts.push(-S, y, -SZ, -S, y, SZ);
            });
            if (medP > 0) {
                const y = sc.mapPartners(medP);
                if (y > 0 && y <= YM) pts.push(-S, y, -SZ, -S, y, SZ);
            }
            makeLines(pts, gridMat());
            // Z=0 白強調（左壁）
            makeLines([-S, 0, 0, -S, YM, 0], whiteMat());
        }

        // ── バウンディング・ボックスのエッジ（輪郭線）─────────────────────
        {
            const edgePts = new Float32Array([
                // 床面 4辺
                -S, 0, -SZ,   S, 0, -SZ,
                -S, 0,  SZ,   S, 0,  SZ,
                -S, 0, -SZ,  -S, 0,  SZ,
                 S, 0, -SZ,   S, 0,  SZ,
                // 奥壁面 縦辺・上辺
                -S, 0, -SZ,  -S, YM, -SZ,
                 S, 0, -SZ,   S, YM, -SZ,
                -S, YM, -SZ,  S, YM, -SZ,
                // 左壁面 追加辺
                -S, YM, -SZ, -S, YM,  SZ,
                -S, 0,   SZ, -S, YM,  SZ,
            ]);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
            sg.add(new THREE.LineSegments(geo,
                new THREE.LineBasicMaterial({ color: 0x6B7280, transparent: true, opacity: 0.90 })
            ));
        }

        return sg;
    };

    // ═══════════════════════════════════════════════════════════════════
    // 6. 国ノード構築
    //    初期位置: X軸上（X=mapNetBalance, Y=0, Z=0）の平置き円盤
    //    目標位置: econospace の Fibonacci 球（X=log輸出, Y=単価, Z=log輸入）
    //    シェーダーが placementT (0→1) に応じて startPos → targetPos を補間。
    //    flowT (0→1) に応じて輸出国は +Y、輸入国は -Y へシフト。
    // ═══════════════════════════════════════════════════════════════════
    TM._econBuildNodes = function (stats, sc, dataGroup) {
        // フィボナッチ球面座標生成（単位球、N 点均等分散）
        const fibonacciSphere = n => {
            const pts = [];
            const ga  = Math.PI * (3.0 - Math.sqrt(5.0)); // 黄金角 ≈ 2.3999 rad
            for (let i = 0; i < n; i++) {
                const y = 1.0 - (i / Math.max(n - 1, 1)) * 2.0;
                const r = Math.sqrt(Math.max(0.0, 1.0 - y * y));
                const theta = ga * i;
                pts.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
            }
            return pts;
        };

        const VOXEL_SIZE = 2.2;
        const countFor   = r => Math.max(24, Math.min(600, Math.round(r * r * 1.6)));

        // エントリ構築（各国の初期・目標座標、ボクセル数、Yシフト方向）
        const entries = [];
        Object.entries(stats).forEach(([iso, s]) => {
            const targetCenter = this._econWorldPos(iso, stats, sc);
            if (!targetCenter) return;
            const startX      = sc.mapNetBalance(s.netBalance);
            const startCenter = new THREE.Vector3(startX, 0, 0);
            const radius      = sc.nodeRadius(s);
            const count       = countFor(radius);
            // 輸出超過 → 上昇(+1)、輸入超過 → 下降(-1)、均衡 → 0
            const yShiftDir   = s.netBalance > 100 ? 1.0 : s.netBalance < -100 ? -1.0 : 0.0;
            entries.push({ iso, s, startCenter, targetCenter, radius, count, yShiftDir });
        });
        if (entries.length === 0) return {};

        const totalVoxels = entries.reduce((sum, e) => sum + e.count, 0);

        // InstancedBufferAttribute バッファ
        const sBuf = new Float32Array(totalVoxels * 3);  // startPos（X軸上の平置き）
        const tBuf = new Float32Array(totalVoxels * 3);  // targetPos（econospace Fibonacci球）
        const dBuf = new Float32Array(totalVoxels);       // 遅延 [0, 0.65]
        const yBuf = new Float32Array(totalVoxels);       // yShiftDir per voxel

        // ── カスタムシェーダーマテリアル ──────────────────────────
        //   MeshBasicMaterial → 光源不要、instanceColor をそのまま出力
        //   onBeforeCompile でポジションをシェーダー内オフセットしているため
        //   Lambert/Phong は法線が origin 基準のまま計算され真っ黒になる。
        //   BasicMaterial は照明計算を行わないため色が正確に表示される。
        const mat = new THREE.MeshBasicMaterial({
            color:        0xffffff,
            vertexColors: true,
            transparent:  true,
            opacity:      0.92,
        });
        mat.customProgramCacheKey = () => 'econspace-node-v3';
        mat.onBeforeCompile = shader => {
            // モジュールレベルの uniform 参照を渡す（.value 更新が即時反映される）
            shader.uniforms.placementT = _econNodeUniforms.placementT;
            shader.uniforms.flowT      = _econNodeUniforms.flowT;

            shader.vertexShader = `
                attribute vec3  startPos;
                attribute vec3  targetPos;
                attribute float delay;
                attribute float yShiftDir;
                uniform   float placementT;
                uniform   float flowT;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>

                // ── Placement animation ─────────────────────────────
                // 各ボクセルは [delay, 1.0] の placementT 区間でアニメーション
                // delay は [0, 0.65] でランダム → 段階的な波状展開効果
                float rawPt = clamp(
                    (placementT - delay) / max(1.0 - delay, 0.001),
                    0.0, 1.0
                );
                // easeInOutCubic: 発射・着地の加速感
                float pt = rawPt < 0.5
                    ? 4.0 * rawPt * rawPt * rawPt
                    : 1.0 - pow(-2.0 * rawPt + 2.0, 3.0) / 2.0;

                vec3 animPos = mix(startPos, targetPos, pt);

                // ── Y-axis shift（flow フェーズ）────────────────────
                // flowT が 0→1 になるにつれて輸出国は上昇、輸入国は下降
                float Y_SHIFT = ${Y_SHIFT_WU.toFixed(1)};
                animPos.y += yShiftDir * Y_SHIFT * flowT;

                transformed = position + animPos;
                `
            );
        };

        const geo   = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
        const iMesh = new THREE.InstancedMesh(geo, mat, totalVoxels);
        iMesh.frustumCulled = false;
        dataGroup.add(iMesh);

        // 全インスタンスを identity matrix で初期化（位置はシェーダーが制御）
        const identity = new THREE.Matrix4();
        for (let i = 0; i < totalVoxels; i++) iMesh.setMatrixAt(i, identity);

        const northBase  = new THREE.Color(0x004990);
        const southBase  = new THREE.Color(0xE87722);
        const northHover = new THREE.Color(0x3A9EFF);
        const southHover = new THREE.Color(0xFFAA44);

        let globalIdx = 0;
        const nodeObjects = {};

        entries.forEach(({ iso, s, startCenter, targetCenter, radius, count, yShiftDir }) => {
            const isDev      = CONFIG.development[iso] === 'north';
            const baseColor  = isDev ? northBase : southBase;
            const hoverColor = isDev ? northHover : southHover;
            const startIdx   = globalIdx;

            fibonacciSphere(count).forEach(pt => {
                const i3 = globalIdx * 3;

                // startPos: X 軸上の小さな円盤形に散布（平置き）
                const angle = Math.random() * Math.PI * 2;
                const dist  = Math.sqrt(Math.random()) * radius * 0.65;
                sBuf[i3]     = startCenter.x + dist * Math.cos(angle);
                sBuf[i3 + 1] = (Math.random() - 0.5) * 2.0;    // Y ≈ 0（ほぼ地面）
                sBuf[i3 + 2] = dist * Math.sin(angle);           // Z ≈ 0（X 軸上）

                // targetPos: econospace での Fibonacci 球面座標
                tBuf[i3]     = targetCenter.x + pt.x * radius;
                tBuf[i3 + 1] = targetCenter.y + pt.y * radius;
                tBuf[i3 + 2] = targetCenter.z + pt.z * radius;

                dBuf[globalIdx] = Math.random() * 0.65;  // ランダム遅延
                yBuf[globalIdx] = yShiftDir;
                iMesh.setColorAt(globalIdx, baseColor);
                globalIdx++;
            });

            // ── 透明ヒットスフィア（RayCaster 専用）──────────────
            // 実質不可視だが RayCaster で検出可能。
            // 初期は startCenter（X 軸上）に置き、アニメーションループで位置を更新。
            const hitGeo  = new THREE.SphereGeometry(radius * 1.08, 8, 6);
            const hitMat  = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.001, depthWrite: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.position.copy(startCenter);
            hitMesh.userData = {
                iso, stats: s,
                iMesh, startIdx, count,
                baseColor:    baseColor.clone(),
                hoverColor:   hoverColor.clone(),
                startCenter:  startCenter.clone(),
                targetCenter: targetCenter.clone(),
                yShiftDir,
            };
            dataGroup.add(hitMesh);
            nodeObjects[iso] = hitMesh;

            // ── グラウンドシャドウ（初期位置の真下 Y=0）──────────
            const shadowGeo = new THREE.CircleGeometry(radius * 1.35, 32);
            const shadowMat = new THREE.MeshBasicMaterial({
                color: isDev ? 0x004990 : 0xE87722,
                transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
            });
            const shadow = new THREE.Mesh(shadowGeo, shadowMat);
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.set(startCenter.x, 0.8, startCenter.z);
            dataGroup.add(shadow);
        });

        // InstancedBufferAttribute をジオメトリにセット
        geo.setAttribute('startPos',  new THREE.InstancedBufferAttribute(sBuf, 3));
        geo.setAttribute('targetPos', new THREE.InstancedBufferAttribute(tBuf, 3));
        geo.setAttribute('delay',     new THREE.InstancedBufferAttribute(dBuf, 1));
        geo.setAttribute('yShiftDir', new THREE.InstancedBufferAttribute(yBuf, 1));

        iMesh.instanceMatrix.needsUpdate = true;
        if (iMesh.instanceColor) iMesh.instanceColor.needsUpdate = true;

        // アニメーションループで hitMesh 位置を更新するためにモジュールスコープへ保存
        _econNodeEntries = entries.map(e => ({ ...e, hitMesh: nodeObjects[e.iso] }));

        return nodeObjects;
    };

    // ═══════════════════════════════════════════════════════════════════
    // 7. フロー パーティクル
    //    time=0 初期状態ではパーティクルはすべてスタート位置で静止。
    //    _econStartFlow 後、アニメーションループが time を更新して飛翔開始。
    // ═══════════════════════════════════════════════════════════════════
    TM._econBuildFlows = function (stats, sc, dataGroup) {
        const netFlows = (STATE.filteredData || []).filter(f =>
            this._econWorldPos(f.exporter, stats, sc) &&
            this._econWorldPos(f.importer,  stats, sc)
        );
        if (netFlows.length === 0) { _econParticleUniforms = null; return; }

        const validFlows = netFlows.map(flow => ({
            ...flow,
            sp: this._econWorldPos(flow.exporter, stats, sc),
            ep: this._econWorldPos(flow.importer,  stats, sc),
        })).filter(f => f.sp && f.ep);
        if (validFlows.length === 0) { _econParticleUniforms = null; return; }

        const MAX_PARTICLES = 3500;
        const totalNetValue = d3.sum(validFlows, f => f.netValue) || 1;

        const flowsWithCount = validFlows.map(flow => ({
            ...flow,
            count: Math.max(2, Math.min(100,
                Math.round((flow.netValue / totalNetValue) * MAX_PARTICLES)
            )),
        }));

        const totalParticles = d3.sum(flowsWithCount, f => f.count);
        if (totalParticles === 0) { _econParticleUniforms = null; return; }

        const PARTICLE_SIZE = 2.2;
        const pGeo = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);

        const sBuf   = new Float32Array(totalParticles * 3);
        const tBuf   = new Float32Array(totalParticles * 3);
        const dBuf   = new Float32Array(totalParticles);
        const colBuf = new Float32Array(totalParticles * 3);

        const JITTER = 3.0;
        const SPREAD = 0.9;
        let idx = 0, globalDelay = 0;

        flowsWithCount.forEach(({ sp, ep, count, flowCategory }) => {
            const col = new THREE.Color(
                (CONFIG.flowColors && CONFIG.flowColors[flowCategory]) || '#aaaaaa'
            );
            for (let i = 0; i < count; i++) {
                const i3 = idx * 3;
                sBuf[i3]     = sp.x + (Math.random() - 0.5) * JITTER;
                sBuf[i3 + 1] = sp.y + (Math.random() - 0.5) * JITTER;
                sBuf[i3 + 2] = sp.z + (Math.random() - 0.5) * JITTER;
                tBuf[i3]     = ep.x + (Math.random() - 0.5) * JITTER;
                tBuf[i3 + 1] = ep.y + (Math.random() - 0.5) * JITTER;
                tBuf[i3 + 2] = ep.z + (Math.random() - 0.5) * JITTER;
                dBuf[idx]    = globalDelay + Math.random() * SPREAD;
                colBuf[i3]   = col.r; colBuf[i3 + 1] = col.g; colBuf[i3 + 2] = col.b;
                idx++;
            }
            globalDelay += SPREAD * 0.25;
        });

        // time=0 → 全パーティクルがスタート位置で静止（flow 開始後に更新）
        const cu = { time: { value: 0.0 } };
        _econParticleUniforms = cu;

        const pMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92 });
        pMat.customProgramCacheKey = () => 'econspace-particle-v2';
        pMat.onBeforeCompile = shader => {
            shader.uniforms.time = cu.time;
            shader.vertexShader = `
                attribute vec3  startPos;
                attribute vec3  targetPos;
                attribute float delay;
                uniform   float time;
            ` + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float duration = 2.8;
                float raw = clamp((time - delay) / duration, 0.0, 1.0);
                // easeInOutCubic
                float t = raw < 0.5
                    ? 4.0 * raw * raw * raw
                    : 1.0 - pow(-2.0 * raw + 2.0, 3.0) / 2.0;
                vec3 animPos = mix(startPos, targetPos, t);
                // 放物線弧（Y 方向の山なりオフセット）
                float arcH = length(targetPos - startPos) * 0.30 + 15.0;
                animPos.y += arcH * sin(t * 3.14159265);
                // 着地前（t > 0.88）で縮小 → ノードに吸収されるイメージ
                float absorb = (t > 0.88) ? 1.0 - (t - 0.88) / 0.12 : 1.0;
                absorb = max(absorb, 0.0);
                transformed = position * absorb + animPos;
                `
            );
        };

        const iMesh = new THREE.InstancedMesh(pGeo, pMat, totalParticles);
        iMesh.frustumCulled = false;
        const identity = new THREE.Matrix4();
        for (let i = 0; i < totalParticles; i++) iMesh.setMatrixAt(i, identity);
        iMesh.instanceMatrix.needsUpdate = true;

        pGeo.setAttribute('startPos',  new THREE.InstancedBufferAttribute(sBuf,   3));
        pGeo.setAttribute('targetPos', new THREE.InstancedBufferAttribute(tBuf,   3));
        pGeo.setAttribute('delay',     new THREE.InstancedBufferAttribute(dBuf,   1));
        pGeo.setAttribute('color',     new THREE.InstancedBufferAttribute(colBuf, 3));

        dataGroup.add(iMesh);
    };

    // ═══════════════════════════════════════════════════════════════════
    // 8. UI ボタン（Start Flow / Reset）— 3D モード時のみ表示
    // ═══════════════════════════════════════════════════════════════════
    TM._econSetupUIButtons = function () {
        let panel = document.getElementById('econ-flow-controls');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'econ-flow-controls';
            document.getElementById('map-container').appendChild(panel);
        }
        panel.style.cssText = `
            position: absolute;
            bottom: 130px; right: 24px;
            z-index: 20;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: auto;
        `;
        panel.innerHTML = `
            <button id="econ-start-btn" style="
                padding: 9px 20px;
                background: #004990;
                color: #ffffff;
                border: none;
                border-radius: 7px;
                font-family: 'Inter', sans-serif;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                letter-spacing: 0.05em;
                box-shadow: 0 2px 10px rgba(0,73,144,0.32);
                user-select: none;
                transition: background 0.15s;
            ">&#9654;&nbsp; Start Flow</button>
            <button id="econ-reset-btn" style="
                padding: 9px 20px;
                background: #F0F4F8;
                color: #4A5568;
                border: 1px solid #CBD5E0;
                border-radius: 7px;
                font-family: 'Inter', sans-serif;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                letter-spacing: 0.05em;
                user-select: none;
                transition: background 0.15s;
            ">&#8635;&nbsp; Reset</button>
        `;

        const self = this;
        document.getElementById('econ-start-btn').addEventListener('click', () => self._econStartFlow());
        document.getElementById('econ-reset-btn').addEventListener('click', () => self._econReset());
    };

    // Start Flow: 常に 2.5D 初期状態からアニメーションを再生
    TM._econStartFlow = function () {
        _econNodeUniforms.placementT.value = 0.0;
        _econNodeUniforms.flowT.value      = 0.0;
        if (_econParticleUniforms) _econParticleUniforms.time.value = 0.0;

        // hitMesh を startCenter（X 軸）に戻す
        _econNodeEntries.forEach(e => {
            if (e.hitMesh) e.hitMesh.position.copy(e.startCenter);
        });

        _econAnimState = 'flowing';
        _econFlowStart = performance.now();
    };

    // Reset: アニメーションを停止し 2.5D 初期状態に戻す
    TM._econReset = function () {
        _econAnimState = 'idle';
        _econNodeUniforms.placementT.value = 0.0;
        _econNodeUniforms.flowT.value      = 0.0;
        if (_econParticleUniforms) _econParticleUniforms.time.value = 0.0;

        _econNodeEntries.forEach(e => {
            if (e.hitMesh) e.hitMesh.position.copy(e.startCenter);
        });
    };

    // ═══════════════════════════════════════════════════════════════════
    // 9. HTML ラベルオーバーレイ（国名・軸名）
    // ═══════════════════════════════════════════════════════════════════
    TM._econBuildLabels = function (stats, sc, nodeObjects) {
        const S  = sc.SPACE;
        const SZ = S * 0.7;
        const YM = sc.Y_MAX;

        let countryContainer = document.getElementById('econ-label-overlay');
        if (!countryContainer) {
            countryContainer = document.createElement('div');
            countryContainer.id = 'econ-label-overlay';
            countryContainer.style.cssText =
                'position:absolute;top:0;left:0;width:100%;height:100%;' +
                'pointer-events:none;overflow:hidden;z-index:15;';
            document.getElementById('map-container').appendChild(countryContainer);
        }
        countryContainer.innerHTML = '';
        countryContainer.style.display = 'block';

        // 総貿易額上位 N 国のみラベル表示
        const LABEL_COUNT = 45;
        const sortedISOs  = Object.keys(stats)
            .filter(iso => nodeObjects[iso])
            .sort((a, b) =>
                (stats[b].totalExport + stats[b].totalImport) -
                (stats[a].totalExport + stats[a].totalImport)
            )
            .slice(0, LABEL_COUNT);

        // buildInner: 国 ISO + パートナー数を表示
        const buildInner = (iso, s) => {
            const isDev = CONFIG.development[iso] === 'north';
            const el    = document.createElement('div');
            el.style.cssText = `
                position:absolute;
                font-size:9px;
                font-family:'Inter',sans-serif;
                font-weight:700;
                color:${isDev ? '#004990' : '#C05621'};
                background:rgba(255,255,255,0.84);
                padding:1px 4px;
                border-radius:3px;
                white-space:nowrap;
                pointer-events:none;
                transform:translate(-50%,-150%);
                border:1px solid ${isDev ? '#00499044' : '#E8772244'};
                letter-spacing:0.03em;
                text-transform:uppercase;
                line-height:1.3;
            `;
            el.innerHTML = `<span>${iso}</span><span style="font-size:7px;opacity:0.72;display:block;font-weight:600;">${s.uniquePartners} partners</span>`;
            el.title = STATE.countryNames[iso] || iso;
            return el;
        };

        const labels = sortedISOs.map(iso => {
            const s  = stats[iso];
            const el = buildInner(iso, s);
            countryContainer.appendChild(el);
            return { el, mesh: nodeObjects[iso] };
        });

        // 軸ラベル（固定位置の凡例）
        let axisContainer = document.getElementById('econ-axis-overlay');
        if (!axisContainer) {
            axisContainer = document.createElement('div');
            axisContainer.id = 'econ-axis-overlay';
            axisContainer.style.cssText =
                'position:absolute;top:0;left:0;width:100%;height:100%;' +
                'pointer-events:none;z-index:14;';
            document.getElementById('map-container').appendChild(axisContainer);
        }
        axisContainer.innerHTML = '';
        axisContainer.style.display = 'block';

        axisContainer.innerHTML = `
            <div style="
                position:absolute;bottom:160px;left:24px;
                background:rgba(255,255,255,0.90);
                border:1px solid #CBD5E0;border-radius:6px;
                padding:8px 12px;font-size:10px;font-family:'Inter',sans-serif;
                line-height:1.7;pointer-events:none;
            ">
                <div style="font-weight:800;color:#1a2332;margin-bottom:4px;font-size:11px;">Economic Space</div>
                <div style="color:#718096;font-size:9px;margin-bottom:6px;font-style:italic;">
                    Initial: X = Net Balance (2.5D)
                </div>
                <div style="color:#4A5568;"><span style="color:#004990;font-weight:700;">X →</span> Gross Trade (IHS)</div>
                <div style="color:#4A5568;"><span style="color:#004990;font-weight:700;">Z ↗</span> Net Ratio (shrinkage)</div>
                <div style="color:#4A5568;"><span style="color:#7C3AED;font-weight:700;">Y ↑</span> Trade Partner Count (Network Centrality)</div>
                <div style="color:#4A5568;"><span style="color:#888;font-weight:700;">⬤</span> Node size = Gross Trade</div>
                <div style="margin-top:5px;padding-top:5px;border-top:1px solid #E2E8F0;color:#718096;font-size:9px;">
                    <span style="color:#ffffff;font-weight:700;">——</span> Z=0 balanced trade<br>
                    <span style="color:#374151;font-weight:700;">- - -</span> partner count: 50 / 100 / 150 / 200
                </div>
            </div>
        `;

        // 軸ティックラベル: バウンディング・ボックスの手前側の縁に配置
        const tickDefs = [
            // Y軸: 左手前の柱 (-S, y, SZ) — パートナー数
            ...[50, 100, 150, 200].map(p => ({
                text: p + 'p',
                pos: new THREE.Vector3(-S, sc.mapPartners(p), SZ),
                style: 'color:#7C3AED;font-size:8px;font-weight:700;',
            })),
            // Y軸: グローバル中央値
            ...(sc.medianPartners > 0 ? [{
                text: 'Med ' + Math.round(sc.medianPartners),
                pos: new THREE.Vector3(-S, sc.mapPartners(sc.medianPartners), SZ),
                style: 'color:#9CA3AF;font-size:7px;font-weight:600;font-style:italic;',
            }] : []),
            // Z軸: 右手前の床エッジ (S, 0, z)
            { text: 'Importer', pos: new THREE.Vector3(S, 0, -SZ),       style: 'color:#C0392B;font-size:8px;font-weight:700;' },
            { text: 'Balanced', pos: new THREE.Vector3(S, 0,   0),        style: 'color:#ffffff;font-size:8px;font-weight:700;' },
            { text: 'Exporter', pos: new THREE.Vector3(S, 0,  SZ),        style: 'color:#004990;font-size:8px;font-weight:700;' },
            // X軸: 手前の床エッジ (x, 0, SZ)
            { text: 'Low',  pos: new THREE.Vector3(-S, 0, SZ),            style: 'color:#718096;font-size:8px;font-weight:600;' },
            { text: 'High', pos: new THREE.Vector3( S, 0, SZ),            style: 'color:#718096;font-size:8px;font-weight:600;' },
        ].filter(d => {
            const y = d.pos.y;
            return y >= -5 && y <= YM + 5;
        });

        const tickEls = tickDefs.map(d => {
            const el = document.createElement('div');
            el.style.cssText = `
                position:absolute;
                font-family:'Inter',sans-serif;
                background:rgba(17,24,39,0.72);
                padding:1px 4px;border-radius:3px;
                pointer-events:none;
                transform:translate(-50%,-50%);
                white-space:nowrap;
                ${d.style}
            `;
            el.textContent = d.text;
            countryContainer.appendChild(el);
            return { el, pos: d.pos };
        });

        // ラベル位置更新クロージャ（アニメーションループから呼ぶ）
        const { camera } = this._3d;
        const projVec = new THREE.Vector3();

        this._econUpdateLabels = () => {
            if (STATE.metric !== 'econspace') return;
            const W = this.width, H = this.height;

            // 国名ラベル
            labels.forEach(({ el, mesh }) => {
                projVec.copy(mesh.position);
                projVec.project(camera);
                const sx = (projVec.x *  0.5 + 0.5) * W;
                const sy = (projVec.y * -0.5 + 0.5) * H;
                if (projVec.z > 1 || sx < -40 || sx > W + 40 || sy < -20 || sy > H + 20) {
                    el.style.display = 'none';
                } else {
                    el.style.display = 'block';
                    el.style.left = sx + 'px';
                    el.style.top  = sy + 'px';
                }
            });

            // 軸ティックラベル
            tickEls.forEach(({ el, pos }) => {
                projVec.copy(pos);
                projVec.project(camera);
                const sx = (projVec.x *  0.5 + 0.5) * W;
                const sy = (projVec.y * -0.5 + 0.5) * H;
                if (projVec.z > 1 || sx < -20 || sx > W + 20 || sy < -10 || sy > H + 10) {
                    el.style.display = 'none';
                } else {
                    el.style.display = 'block';
                    el.style.left = sx + 'px';
                    el.style.top  = sy + 'px';
                }
            });
        };
    };

    // ═══════════════════════════════════════════════════════════════════
    // 10. 凡例パネルの更新
    // ═══════════════════════════════════════════════════════════════════
    TM._econBuildLegend = function (stats) {
        const titleEl = document.getElementById('legend-title');
        if (titleEl) titleEl.innerText = 'Econ Space (3D)';

        const content = document.getElementById('legend-content');
        if (!content) return;

        const vals          = Object.values(stats);
        const maxPartners   = d3.max(vals, s => s.uniquePartners) || 0;
        const medPartners   = Math.round(d3.median(vals, s => s.uniquePartners) || 0);
        const avgPartners   = Math.round(d3.mean(vals, s => s.uniquePartners) || 0);
        const countryCount  = vals.length;

        content.innerHTML = `
            <div class="space-y-2 text-[10px]">
                <div class="border-t border-[#E2E8F0] pt-2">
                    <div class="font-bold text-[11px] text-[#1a2332] mb-1.5">Node Color</div>
                    <div class="flex items-center gap-2 mb-1">
                        <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:#004990"></div>
                        <span class="text-[#4A5568]">Developed (North)</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:#E87722"></div>
                        <span class="text-[#4A5568]">Developing (South)</span>
                    </div>
                </div>
                <div class="border-t border-[#E2E8F0] pt-2">
                    <div class="font-bold text-[11px] text-[#1a2332] mb-1">Initial X-axis</div>
                    <div class="text-[#718096]">Net Trade Balance</div>
                    <div class="text-[9px] text-[#A0AEC0] mt-0.5">Right = export surplus</div>
                </div>
                <div class="border-t border-[#E2E8F0] pt-2">
                    <div class="font-bold text-[11px] text-[#1a2332] mb-1">Node Size</div>
                    <div class="text-[#718096]">∝ IHS(Gross Trade)</div>
                    <div class="text-[9px] text-[#A0AEC0] mt-0.5">independent of axes</div>
                </div>
                <div class="border-t border-[#E2E8F0] pt-2">
                    <div class="font-bold text-[11px] text-[#1a2332] mb-1">Trade Partners (Y-axis)</div>
                    <div class="flex justify-between"><span class="text-[#718096]">Max</span><span class="font-bold text-[#1a2332]">${maxPartners} countries</span></div>
                    <div class="flex justify-between mt-0.5"><span class="text-[#718096]">Median</span><span class="font-bold text-[#1a2332]">${medPartners} countries</span></div>
                    <div class="flex justify-between mt-0.5"><span class="text-[#718096]">Mean</span><span class="font-bold text-[#1a2332]">${avgPartners} countries</span></div>
                </div>
                <div class="border-t border-[#E2E8F0] pt-2">
                    <div class="font-bold text-[11px] text-[#1a2332] mb-1">Countries</div>
                    <div class="flex justify-between"><span class="text-[#718096]">Active</span><span class="font-bold text-[#1a2332]">${countryCount}</span></div>
                </div>
                <div class="border-t border-[#E2E8F0] pt-2 text-[9px] text-[#718096] italic">
                    Press Start Flow to animate<br>Drag to rotate · Scroll to zoom<br>Hover node for details
                </div>
            </div>
        `;
    };

    // ═══════════════════════════════════════════════════════════════════
    // 11. RayCaster インタラクション（ホバーツールチップ）
    // ═══════════════════════════════════════════════════════════════════
    TM._econSetupInteraction = function (nodeObjects) {
        const { camera, canvas } = this._3d;
        const rc    = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const meshes = Object.values(nodeObjects);

        if (this._econMouseMoveListener) {
            canvas.removeEventListener('mousemove', this._econMouseMoveListener);
            this._econMouseMoveListener = null;
        }

        const fmt = v => {
            const a = Math.abs(v), s = v < 0 ? '-' : '';
            if (a >= 1e9) return s + '$' + d3.format('.2f')(a / 1e9) + 'B';
            if (a >= 1e6) return s + '$' + d3.format('.2f')(a / 1e6) + 'M';
            if (a >= 1e3) return s + '$' + d3.format('.2f')(a / 1e3) + 'K';
            return s + '$' + d3.format(',.0f')(a);
        };

        const applyVoxelColor = (hitMesh, useHover) => {
            const { iMesh, startIdx, count, baseColor, hoverColor } = hitMesh.userData;
            if (!iMesh) return;
            const col = useHover ? hoverColor : baseColor;
            for (let i = startIdx; i < startIdx + count; i++) iMesh.setColorAt(i, col);
            iMesh.instanceColor.needsUpdate = true;
        };

        let hoveredMesh = null;

        const onMove = e => {
            if (STATE.metric !== 'econspace') return;
            const rect = canvas.getBoundingClientRect();
            mouse.x    =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
            mouse.y    = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
            rc.setFromCamera(mouse, camera);

            const hits = rc.intersectObjects(meshes);
            const hit  = hits.length > 0 ? hits[0].object : null;

            if (hoveredMesh && hoveredMesh !== hit) {
                applyVoxelColor(hoveredMesh, false);
                hoveredMesh = null;
            }
            if (hit && hit !== hoveredMesh) {
                hoveredMesh = hit;
                applyVoxelColor(hit, true);
            }

            if (hit) {
                canvas.style.cursor = 'pointer';
                const { iso, stats: s } = hit.userData;
                const name   = STATE.countryNames[iso] || iso;
                const isDev  = CONFIG.development[iso] === 'north';
                const balCol = s.netBalance >= 0 ? '#004990' : '#C0392B';

                const tooltip = document.getElementById('tooltip');
                if (tooltip) {
                    tooltip.innerHTML = `
                        <div style="background:#fff;border:1px solid #CBD5E0;border-radius:8px;
                                    box-shadow:0 4px 16px rgba(0,0,0,0.12);padding:12px 14px;
                                    font-family:'Inter',sans-serif;font-size:12px;min-width:210px;">
                            <div style="font-weight:800;font-size:13px;color:#1a2332;margin-bottom:2px;">${name}</div>
                            <div style="font-size:10px;color:${isDev ? '#004990' : '#E87722'};font-weight:600;margin-bottom:8px;">
                                ${isDev ? 'Developed (North)' : 'Developing (South)'}
                            </div>
                            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                                <span style="color:#718096;">Export Value</span>
                                <span style="font-weight:700;color:#004990;">${fmt(s.totalExport)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                                <span style="color:#718096;">Import Value</span>
                                <span style="font-weight:700;color:#C0392B;">${fmt(s.totalImport)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;border-top:1px solid #E2E8F0;padding-top:4px;margin-top:4px;">
                                <span style="color:#718096;">Net Balance</span>
                                <span style="font-weight:700;color:${balCol};">${fmt(s.netBalance)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;border-top:1px solid #E2E8F0;padding-top:4px;margin-top:4px;">
                                <span style="color:#718096;">Trade Partners</span>
                                <span style="font-weight:700;color:#7C3AED;">${s.uniquePartners} countries</span>
                            </div>
                        </div>
                    `;
                    tooltip.classList.remove('hidden');
                    tooltip.style.left = (e.clientX + 14) + 'px';
                    tooltip.style.top  = (e.clientY - 12) + 'px';
                }
            } else {
                canvas.style.cursor = 'grab';
                const tooltip = document.getElementById('tooltip');
                if (tooltip) tooltip.classList.add('hidden');
            }
        };

        this._econMouseMoveListener = onMove;
        canvas.addEventListener('mousemove', onMove);

        if (!this._3d._econLeaveListener) {
            this._3d._econLeaveListener = () => {
                if (hoveredMesh) { applyVoxelColor(hoveredMesh, false); hoveredMesh = null; }
                const tooltip = document.getElementById('tooltip');
                if (tooltip) tooltip.classList.add('hidden');
            };
            canvas.addEventListener('mouseleave', this._3d._econLeaveListener);
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // 12. アニメーションループ
    //     'flowing' 状態のみ uniforms を更新。
    //     hitMesh 位置も毎フレーム更新（RayCaster の当たり判定を同期）。
    // ═══════════════════════════════════════════════════════════════════
    TM._econStartAnimation = function () {
        if (this._3d.econAnimFrameId) {
            cancelAnimationFrame(this._3d.econAnimFrameId);
            this._3d.econAnimFrameId = null;
        }

        const loop = () => {
            if (STATE.metric !== 'econspace') return;

            if (_econAnimState === 'flowing') {
                const elapsed = (performance.now() - _econFlowStart) / 1000;

                // ── Phase 1: ノードを econospace へ移動（0 → PLACEMENT_DUR 秒）──
                const pt = Math.min(elapsed / PLACEMENT_DUR, 1.0);
                _econNodeUniforms.placementT.value = pt;

                // ── Phase 2: Y シフト（YSHIFT_DELAY 後から YSHIFT_DUR 秒かけて完了）──
                const ftRaw = Math.max(0, elapsed - YSHIFT_DELAY) / YSHIFT_DUR;
                const ft    = Math.min(ftRaw, 1.0);
                _econNodeUniforms.flowT.value = ft;

                // hitMesh 位置の更新（RayCaster 当たり判定を視覚と同期）
                _econNodeEntries.forEach(e => {
                    if (!e.hitMesh) return;
                    if (pt < 1.0) {
                        // Phase 1: startCenter → targetCenter 補間
                        e.hitMesh.position.lerpVectors(e.startCenter, e.targetCenter, pt);
                    } else {
                        // Phase 2: targetCenter + Yシフト
                        e.hitMesh.position.set(
                            e.targetCenter.x,
                            e.targetCenter.y + e.yShiftDir * Y_SHIFT_WU * ft,
                            e.targetCenter.z
                        );
                    }
                });

                // パーティクル飛翔時間（flow 開始からの経過秒数）
                if (_econParticleUniforms) _econParticleUniforms.time.value = elapsed;

                // 全フェーズ完了
                if (pt >= 1.0 && ftRaw >= 1.0) _econAnimState = 'done';
            }

            if (this._econUpdateLabels) this._econUpdateLabels();
            this._3d.econAnimFrameId = requestAnimationFrame(loop);
        };

        loop();
    };

    // ═══════════════════════════════════════════════════════════════════
    // 13. メイン描画関数
    // ═══════════════════════════════════════════════════════════════════
    TM.renderEconSpace3D = function () {
        const { scene, camera, controls } = this._3d;
        if (!scene) return;

        // モジュール状態をリセット（年・地域変更時の再描画に対応）
        _econAnimState = 'idle';
        _econNodeUniforms.placementT.value = 0.0;
        _econNodeUniforms.flowT.value      = 0.0;
        _econParticleUniforms = null;
        _econNodeEntries      = [];

        // 既存アニメーションを停止
        if (this._3d.econAnimFrameId) {
            cancelAnimationFrame(this._3d.econAnimFrameId);
            this._3d.econAnimFrameId = null;
        }
        if (this._3d.animationFrameId) {
            cancelAnimationFrame(this._3d.animationFrameId);
            this._3d.animationFrameId = null;
        }
        this._3d.customUniforms    = null;
        this._3d.customUniformSets = [];

        // Weight モードの描画グループを非表示
        if (this._3d.dataGroup)   this._3d.dataGroup.visible   = false;
        if (this._3d.staticGroup) this._3d.staticGroup.visible  = false;
        const hitOverlay = document.getElementById('hit-overlay-svg');
        if (hitOverlay) hitOverlay.style.display = 'none';

        // データ計算
        const stats = this._econComputeStats();
        if (!stats || Object.keys(stats).length === 0) return;
        const sc = this._econBuildScales(stats);

        // 動的グループのクリーンアップ & 再構築
        this._econClearDynamic();
        this._econBuildStaticScene(sc);

        this._3d.econDataGroup = new THREE.Group();
        scene.add(this._3d.econDataGroup);

        const nodeObjects = this._econBuildNodes(stats, sc, this._3d.econDataGroup);
        this._econBuildFlows(stats, sc, this._3d.econDataGroup);
        this._econBuildLabels(stats, sc, nodeObjects);
        this._econBuildLegend(stats);
        this._econSetupInteraction(nodeObjects);
        this._econSetupUIButtons();

        // 初期カメラ: X 軸の 2.5D レイアウトが正面に見える位置
        const S = sc.SPACE;
        camera.position.set(0, S * 0.35, S * 1.9);
        camera.lookAt(0, 10, 0);
        controls.target.set(0, 10, 0);
        controls.update();

        this._econStartAnimation();
    };

    // ═══════════════════════════════════════════════════════════════════
    // 14. flyCamera3DPreset のオーバーライド
    // ═══════════════════════════════════════════════════════════════════
    const _origFlyCamera = TM.flyCamera3DPreset;
    TM.flyCamera3DPreset = function (preset) {
        if (STATE.metric !== 'econspace') {
            _origFlyCamera.call(this, preset);
            return;
        }
        const { camera, controls } = this._3d;
        const S = 460;
        const prigs = {
            'global':   { pos: [0, S * 0.35, S * 1.9],  target: [0, 10, 0] },
            'aerial':   { pos: [0, S * 1.5, S * 0.1],   target: [0, 50, 0] },
            'horizon':  { pos: [S * 1.6, 80, 0],         target: [0, 80, 0] },
            'atlantic': { pos: [S, S * 0.6, S * 1.2],   target: [0, 70, 0] },
            'pacific':  { pos: [-S, S * 0.4, S * 1.3],  target: [0, 60, 0] },
        };
        const dest = prigs[preset] || prigs['global'];
        const sT = controls.target.clone(), eT = new THREE.Vector3(...dest.target);
        const sP = camera.position.clone(), eP = new THREE.Vector3(...dest.pos);
        d3.transition('cameraFly').duration(1200).ease(d3.easeCubicInOut)
            .tween('cameraFly', () => t => {
                controls.target.lerpVectors(sT, eT, t);
                camera.position.lerpVectors(sP, eP, t);
                controls.update();
            });
    };

    // ═══════════════════════════════════════════════════════════════════
    // 15. renderFlows のオーバーライド（第3モード分岐を追加）
    // ═══════════════════════════════════════════════════════════════════
    const _origRenderFlows = TM.renderFlows;
    TM.renderFlows = function () {
        const isEcon = (STATE.metric === 'econspace');

        if (!isEcon) {
            // EconSpace UI を非表示
            ['econ-label-overlay', 'econ-axis-overlay'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            const flowCtrl = document.getElementById('econ-flow-controls');
            if (flowCtrl) flowCtrl.style.display = 'none';

            // アニメーション停止
            if (this._3d.econAnimFrameId) {
                cancelAnimationFrame(this._3d.econAnimFrameId);
                this._3d.econAnimFrameId = null;
            }
            // マウスリスナー解除
            if (this._econMouseMoveListener && this._3d.canvas) {
                this._3d.canvas.removeEventListener('mousemove', this._econMouseMoveListener);
                this._econMouseMoveListener = null;
            }
            // EconSpace シーンを非表示
            if (this._3d.econStaticGroup) this._3d.econStaticGroup.visible = false;
            if (this._3d.econDataGroup)   this._3d.econDataGroup.visible   = false;
            // Weight モードの描画グループを復元
            if (this._3d.dataGroup)   this._3d.dataGroup.visible   = true;
            if (this._3d.staticGroup) this._3d.staticGroup.visible  = true;
            _origRenderFlows.call(this);
            return;
        }

        // EconSpace モードの処理
        const view3dPanel = document.getElementById('view3d-panel');
        if (view3dPanel) view3dPanel.classList.remove('hidden');

        this.svg.style('display', 'none');
        if (this._3d.canvas) {
            this._3d.canvas.style.display     = 'block';
            this._3d.canvas.style.pointerEvents = 'auto';
        }

        if (this._3d.econStaticGroup) this._3d.econStaticGroup.visible = true;
        if (this._3d.econDataGroup)   this._3d.econDataGroup.visible   = true;

        this.renderEconSpace3D();
    };

    console.info('[EconSpace3D] v2 Flow Space loaded — 2.5D → 3D animation mode.');

})();
