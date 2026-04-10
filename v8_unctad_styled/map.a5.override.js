
(function () {
    const TM = (typeof window !== 'undefined' && window.TradeMap)
        ? window.TradeMap
        : (typeof globalThis !== 'undefined' ? globalThis.TradeMap : null);

    if (!TM) {
        console.error('[TradeMap A5] TradeMap が見つからないため、飛来アニメーション版を適用できませんでした。');
        return;
    }
    if (!window.THREE) {
        console.error('[TradeMap A5] THREE が見つからないため、飛来アニメーション版を適用できませんでした。');
        return;
    }

    TM.render3DFlows = function render3DFlowsA5() {
        const { scene, camera, canvas } = this._3d;
        if (!scene) return;

        // 旧アニメーションが残っていれば停止
        if (this._3d.animationFrameId) {
            cancelAnimationFrame(this._3d.animationFrameId);
            this._3d.animationFrameId = null;
        }
        this._3d.customUniforms = null;
        this._3d.customUniformSets = [];

        // 1. 静的マップ（陸地ワイヤーフレーム）の維持
        const needsStaticRebuild = (
            !this._3d.staticGroup ||
            this._3d.lastWidth !== this.width ||
            this._3d.lastHeight !== this.height
        );

        if (needsStaticRebuild) {
            if (this._3d.staticGroup) {
                scene.remove(this._3d.staticGroup);
                this._3d.staticGroup.children.forEach((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }

            this._3d.staticGroup = new THREE.Group();
            scene.add(this._3d.staticGroup);
            this._3d.lastWidth = this.width;
            this._3d.lastHeight = this.height;

            if (STATE.geoData) {
                const allPositions = [];
                for (const feature of STATE.geoData.features) {
                    const geom = feature.geometry;
                    if (!geom) continue;
                    const polys = geom.type === 'Polygon'
                        ? [geom.coordinates]
                        : geom.type === 'MultiPolygon'
                            ? geom.coordinates
                            : [];

                    for (const polygon of polys) {
                        for (const ring of polygon) {
                            for (let i = 0; i < ring.length - 1; i++) {
                                const p1 = this.projection(ring[i]);
                                const p2 = this.projection(ring[i + 1]);
                                if (!p1 || !p2) continue;
                                if (Math.abs(p1[0] - p2[0]) > this.width / 2) continue;
                                allPositions.push(
                                    p1[0] - this.width / 2, -(p1[1] - this.height / 2), 0,
                                    p2[0] - this.width / 2, -(p2[1] - this.height / 2), 0
                                );
                            }
                        }
                    }
                }

                if (allPositions.length > 0) {
                    const geo = new THREE.BufferGeometry();
                    geo.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
                    const mat = new THREE.LineBasicMaterial({ color: 0xCBD5E0, transparent: true, opacity: 0.9 });
                    const borderLines = new THREE.LineSegments(geo, mat);
                    this._3d.staticGroup.add(borderLines);
                }
            }

            camera.position.set(0, -this.height * 0.45, Math.max(this.width, this.height) * 0.67);
            camera.lookAt(0, 0, 0);
            this._3d.controls.target.set(0, 0, 0);
        }

        // 2. 動的データグループの初期化
        if (!this._3d.dataGroup) {
            this._3d.dataGroup = new THREE.Group();
            scene.add(this._3d.dataGroup);
        } else {
            while (this._3d.dataGroup.children.length > 0) {
                const child = this._3d.dataGroup.children[0];
                this._3d.dataGroup.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
                    else child.material.dispose();
                }
            }
        }

        const get3DPos = (iso) => {
            const coords = STATE.countryCoords[iso];
            if (!coords) return null;
            const p = this.projection(coords);
            if (!p) return null;
            return new THREE.Vector3(p[0] - this.width / 2, -(p[1] - this.height / 2), 0);
        };

        const rawFlows = Array.isArray(STATE.filteredData) ? STATE.filteredData : [];
        const netFlows = rawFlows.filter((d) => !!get3DPos(d.importer) && !!get3DPos(d.exporter));
        if (netFlows.length === 0) {
            this._3d.instancedMesh = null;
            this._3d.instancedMeshes = [];
            this._3d.instanceData = [];
            if (this.render3DLegend) this.render3DLegend();
            return;
        }

        // --- 3. ボクセル事前計算 ---
        const VALUE_PER_VOXEL = 50000;
        const MAX_VOXELS_PER_FLOW = 5000;
        const VOXEL_SIZE = 1.0;
        const STRATA_ORDER = ['south-south', 'north-south', 'south-north', 'north-north'];
        const CATEGORY_ORDER = ['north-south', 'south-north', 'south-south', 'north-north'];

        const importerGroups = {};
        netFlows.forEach((d) => {
            if (!importerGroups[d.importer]) importerGroups[d.importer] = [];
            importerGroups[d.importer].push(d);
        });

        const categoryCounts = {
            'north-south': 0,
            'south-north': 0,
            'south-south': 0,
            'north-north': 0,
        };

        Object.keys(importerGroups).forEach((iso) => {
            importerGroups[iso].sort(
                (a, b) => STRATA_ORDER.indexOf(a.flowCategory) - STRATA_ORDER.indexOf(b.flowCategory)
            );
            importerGroups[iso].forEach((flow) => {
                const count = Math.min(
                    MAX_VOXELS_PER_FLOW,
                    Math.max(1, Math.floor(flow.netValue / VALUE_PER_VOXEL))
                );
                flow.voxelCount = count;
                if (categoryCounts[flow.flowCategory] === undefined) categoryCounts[flow.flowCategory] = 0;
                categoryCounts[flow.flowCategory] += count;
            });
        });

        const totalParticles = Object.values(categoryCounts).reduce((sum, n) => sum + n, 0);
        if (totalParticles === 0) {
            this._3d.instancedMesh = null;
            this._3d.instancedMeshes = [];
            this._3d.instanceData = [];
            if (this.render3DLegend) this.render3DLegend();
            return;
        }

        // --- 4. 有機的な山（Sandpile）レイアウト ---
        const buildOrganicMountainLayout = (totalVoxels) => {
            const R = 4.0;
            const STEEPNESS = 1.5;
            const validCells = [];
            const heightMap = {};

            for (let x = -R; x <= R; x++) {
                for (let y = -R; y <= R; y++) {
                    const dist = Math.sqrt(x * x + y * y);
                    if (dist <= R + 0.2) {
                        validCells.push({ x, y, dist });
                        heightMap[`${x},${y}`] = 0;
                    }
                }
            }

            validCells.sort((a, b) => a.dist - b.dist);
            const layout = [];
            for (let i = 0; i < totalVoxels; i++) {
                let minScore = Infinity;
                let bestCell = null;
                for (const cell of validCells) {
                    const z = heightMap[`${cell.x},${cell.y}`];
                    const score = z + (cell.dist * STEEPNESS);
                    if (score < minScore) {
                        minScore = score;
                        bestCell = cell;
                    }
                }
                const z = heightMap[`${bestCell.x},${bestCell.y}`];
                layout.push({ dx: bestCell.x, dy: bestCell.y, dz: z });
                heightMap[`${bestCell.x},${bestCell.y}`]++;
            }
            layout.sort((a, b) => a.dz - b.dz);
            return layout;
        };

        // --- 5. カテゴリ別4メッシュ + 飛来アニメーション ---
        const meshesByCategory = {};
        const meshArray = [];
        const uniformSets = [];

        CATEGORY_ORDER.forEach((category) => {
            const count = categoryCounts[category] || 0;
            if (count <= 0) return;

            const geometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
            const startPositions = new Float32Array(count * 3);
            const targetPositions = new Float32Array(count * 3);
            const delays = new Float32Array(count);

            const material = new THREE.MeshBasicMaterial({
                color: (CONFIG.flowColors && CONFIG.flowColors[category]) || '#ffffff',
                transparent: false,
                opacity: 1.0,
            });

            const customUniforms = { time: { value: 0 } };
            material.customProgramCacheKey = () => `voxel-flight-${category}`;
            material.onBeforeCompile = (shader) => {
                shader.uniforms.time = customUniforms.time;
                shader.vertexShader = `
                    attribute vec3 targetPos;
                    attribute vec3 startPos;
                    attribute float delay;
                    uniform float time;
                ` + shader.vertexShader;

                shader.vertexShader = shader.vertexShader.replace(
                    `#include <begin_vertex>`,
                    `
                    #include <begin_vertex>

                    float duration = 2.0;
                    float progress = clamp((time - delay) / duration, 0.0, 1.0);
                    progress = 1.0 - pow(1.0 - progress, 3.0);

                    vec3 animatedPos = mix(startPos, targetPos, progress);
                    float heightFac = length(targetPos - startPos) * 0.4;
                    if (progress > 0.0 && progress < 1.0) {
                        animatedPos.z += heightFac * sin(progress * 3.14159265);
                    }

                    transformed = position + animatedPos;
                    `
                );
            };

            const mesh = new THREE.InstancedMesh(geometry, material, count);
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.userData.instanceData = new Array(count);
            mesh.userData.flowCategory = category;
            mesh.userData.startPositions = startPositions;
            mesh.userData.targetPositions = targetPositions;
            mesh.userData.delays = delays;
            mesh.userData.customUniforms = customUniforms;

            this._3d.dataGroup.add(mesh);
            meshesByCategory[category] = mesh;
            meshArray.push(mesh);
            uniformSets.push(customUniforms);
        });

        let categoryStartTime = 0;

        for (const [iso, flows] of Object.entries(importerGroups)) {
            const baseTargetPos = get3DPos(iso);
            if (!baseTargetPos) continue;

            const totalVoxelsForCountry = flows.reduce((sum, f) => sum + f.voxelCount, 0);
            const layout = buildOrganicMountainLayout(totalVoxelsForCountry);
            let layoutIdx = 0;
            let currentImporterDelay = categoryStartTime;

            for (const flow of flows) {
                const mesh = meshesByCategory[flow.flowCategory];
                const startPos = get3DPos(flow.exporter);
                if (!mesh || !startPos) {
                    layoutIdx += flow.voxelCount;
                    continue;
                }

                const flowSpread = Math.sqrt(flow.voxelCount) * 0.05;
                const startPositions = mesh.userData.startPositions;
                const targetPositions = mesh.userData.targetPositions;
                const delays = mesh.userData.delays;

                for (let i = 0; i < flow.voxelCount; i++) {
                    if (layoutIdx >= layout.length) break;
                    const { dx, dy, dz } = layout[layoutIdx];
                    const tx = baseTargetPos.x + dx * VOXEL_SIZE;
                    const ty = baseTargetPos.y + dy * VOXEL_SIZE;
                    const tz = dz * VOXEL_SIZE + VOXEL_SIZE / 2;
                    const idx = mesh.count;
                    const i3 = idx * 3;

                    // shader 側で移動するため、InstanceMatrix は単位行列のまま
                    const identity = new THREE.Matrix4();
                    mesh.setMatrixAt(idx, identity);

                    startPositions[i3] = startPos.x;
                    startPositions[i3 + 1] = startPos.y;
                    startPositions[i3 + 2] = startPos.z;

                    targetPositions[i3] = tx;
                    targetPositions[i3 + 1] = ty;
                    targetPositions[i3 + 2] = tz;

                    delays[idx] = currentImporterDelay + Math.random() * flowSpread;

                    mesh.userData.instanceData[idx] = {
                        importer: iso,
                        exporter: flow.exporter,
                        category: flow.flowCategory,
                    };

                    mesh.count += 1;
                    layoutIdx += 1;
                }

                currentImporterDelay += flowSpread * 0.1;
            }
        }

        meshArray.forEach((mesh) => {
            const usedCount = mesh.count;
            const geometry = mesh.geometry;
            const startPositions = mesh.userData.startPositions;
            const targetPositions = mesh.userData.targetPositions;
            const delays = mesh.userData.delays;

            geometry.setAttribute(
                'startPos',
                new THREE.InstancedBufferAttribute(startPositions.subarray(0, usedCount * 3), 3)
            );
            geometry.setAttribute(
                'targetPos',
                new THREE.InstancedBufferAttribute(targetPositions.subarray(0, usedCount * 3), 3)
            );
            geometry.setAttribute(
                'delay',
                new THREE.InstancedBufferAttribute(delays.subarray(0, usedCount), 1)
            );

            mesh.instanceMatrix.needsUpdate = true;
            mesh.material.needsUpdate = true;
            if (mesh.userData.instanceData.length > usedCount) {
                mesh.userData.instanceData = mesh.userData.instanceData.slice(0, usedCount);
            }
        });

        this._3d.instancedMeshes = meshArray;
        this._3d.instancedMesh = meshArray[0] || null;
        this._3d.instanceData = [];
        this._3d.customUniformSets = uniformSets;
        this._3d.customUniforms = uniformSets[0] || null;

        // --- 6a. Arc Route Lines (トレードハイウェイ・グロー) ---
        // 各フローの輸出元→輸入先を放物線アーク（QuadraticBezier）で描画
        // カテゴリ別に LineSegments にバッチ化して低オパシティで表示
        {
            const arcByCategory = {};
            CATEGORY_ORDER.forEach((cat) => { arcByCategory[cat] = []; });

            netFlows.forEach((flow) => {
                const sp = get3DPos(flow.exporter);
                const ep = get3DPos(flow.importer);
                if (!sp || !ep) return;

                const dist = sp.distanceTo(ep);
                const mid = new THREE.Vector3(
                    (sp.x + ep.x) / 2,
                    (sp.y + ep.y) / 2,
                    dist * 0.22 + 12
                );

                const curve = new THREE.QuadraticBezierCurve3(sp, mid, ep);
                const pts = curve.getPoints(18);
                const arr = arcByCategory[flow.flowCategory];
                if (!arr) return;
                for (let i = 0; i < pts.length - 1; i++) {
                    arr.push(
                        pts[i].x, pts[i].y, pts[i].z,
                        pts[i + 1].x, pts[i + 1].y, pts[i + 1].z
                    );
                }
            });

            CATEGORY_ORDER.forEach((category) => {
                const positions = arcByCategory[category];
                if (!positions || positions.length === 0) return;
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                const color = (CONFIG.flowColors && CONFIG.flowColors[category]) || '#ffffff';
                const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.13 });
                this._3d.dataGroup.add(new THREE.LineSegments(geo, mat));
            });
        }

        // --- 6. ホバー ---
        // Raycaster はボクセル位置をGPUシェーダーで計算しているため使用不可
        // （CPU側のInstanceMatrixは単位行列のままでありRaycasterは全ボクセルをoriginと判定する）
        // → _build3DHitOverlay によるSVGサークル方式を使用する

        // canvas を離れたときだけツールチップを隠す（onMouseLeave のみ登録）
        if (!this._3d.onMouseLeave) {
            this._3d.onMouseLeave = () => {
                App.hideTooltip();
                if (this._3d.canvas) this._3d.canvas.style.cursor = 'grab';
            };
            canvas.addEventListener('mouseleave', this._3d.onMouseLeave);
        }

        if (this.render3DLegend) this.render3DLegend();

        // SVGヒットオーバーレイ（国ごとの透明サークル）を構築
        if (this._build3DHitOverlay) this._build3DHitOverlay(importerGroups);

        // --- 7. アニメーション時間更新 ---
        const startTime = performance.now();
        const animateVoxelTime = () => {
            if (STATE.metric !== 'weight' || !this._3d.customUniformSets || this._3d.customUniformSets.length === 0) return;
            const elapsedTime = (performance.now() - startTime) / 1000;
            this._3d.customUniformSets.forEach((u) => {
                if (u && u.time) u.time.value = elapsedTime;
            });
            this._3d.animationFrameId = requestAnimationFrame(animateVoxelTime);
        };
        animateVoxelTime();
    };

    console.info('[TradeMap A5] 固定色4メッシュ + 輸出元からの飛来アニメーション版 render3DFlows を適用しました。');
})();
