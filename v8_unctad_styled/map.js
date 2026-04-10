const TradeMap = {
    isoMap: {
        "4": "AFG", "8": "ALB", "12": "DZA", "24": "AGO", "32": "ARG", "51": "ARM", "36": "AUS",
        "40": "AUT", "31": "AZE", "44": "BHS", "48": "BHR", "50": "BGD", "52": "BRB", "112": "BLR",
        "56": "BEL", "84": "BLZ", "204": "BEN", "64": "BTN", "68": "BOL", "70": "BIH", "72": "BWA",
        "76": "BRA", "96": "BRN", "100": "BGR", "854": "BFA", "108": "BDI", "116": "KHM", "120": "CMR",
        "124": "CAN", "140": "CAF", "148": "TCD", "152": "CHL", "156": "CHN", "170": "COL", "174": "COM",
        "178": "COG", "180": "COD", "188": "CRI", "384": "CIV", "191": "HRV", "192": "CUB", "196": "CYP",
        "203": "CZE", "208": "DNK", "262": "DJI", "214": "DOM", "218": "ECU", "818": "EGY", "222": "SLV",
        "226": "GNQ", "232": "ERI", "233": "EST", "231": "ETH", "242": "FJI", "246": "FIN", "250": "FRA",
        "266": "GAB", "270": "GMB", "268": "GEO", "276": "DEU", "288": "GHA", "300": "GRC", "304": "GRL",
        "308": "GRD", "320": "GTM", "324": "GIN", "624": "GNB", "328": "GUY", "332": "HTI", "340": "HND",
        "344": "HKG", "348": "HUN", "352": "ISL", "356": "IND", "360": "IDN", "364": "IRN", "368": "IRQ",
        "372": "IRL", "376": "ISR", "380": "ITA", "388": "JAM", "392": "JPN", "400": "JOR", "398": "KAZ",
        "404": "KEN", "408": "PRK", "410": "KOR", "414": "KWT", "417": "KGZ", "418": "LAO", "428": "LVA",
        "422": "LBN", "426": "LSO", "430": "LBR", "434": "LBY", "440": "LTU", "442": "LUX", "807": "MKD",
        "450": "MDG", "454": "MWI", "458": "MYS", "462": "MDV", "466": "MLI", "470": "MLT", "478": "MRT",
        "480": "MUS", "484": "MEX", "498": "MDA", "496": "MNG", "499": "MNE", "504": "MAR", "508": "MOZ",
        "104": "MMR", "516": "NAM", "524": "NPL", "528": "NLD", "540": "NCL", "554": "NZL", "558": "NIC",
        "562": "NER", "566": "NGA", "578": "NOR", "512": "OMN", "586": "PAK", "591": "PAN", "598": "PNG",
        "600": "PRY", "604": "PER", "608": "PHL", "616": "POL", "620": "PRT", "630": "PRI", "634": "QAT",
        "642": "ROU", "643": "RUS", "646": "RWA", "682": "SAU", "686": "SEN", "688": "SRB", "694": "SLE",
        "702": "SGP", "703": "SVK", "705": "SVN", "90": "SLB", "706": "SOM", "710": "ZAF", "728": "SSD",
        "724": "ESP", "144": "LKA", "729": "SDN", "740": "SUR", "748": "SWZ", "752": "SWE", "756": "CHE",
        "760": "SYR", "158": "TWN", "762": "TJK", "834": "TZA", "764": "THA", "626": "TLS", "768": "TGO",
        "780": "TTO", "788": "TUN", "792": "TUR", "795": "TKM", "800": "UGA", "804": "UKR", "784": "ARE",
        "826": "GBR", "840": "USA", "858": "URY", "860": "UZB", "548": "VUT", "862": "VEN", "704": "VNM",
        "732": "ESH", "887": "YEM", "894": "ZMB", "716": "ZWE"
    },

    // ── 2D (D3.js) 状態管理 ──────────────────────────────
    svg: null,
    g: null,
    projection: null,
    path: null,
    zoomBehavior: null,

    // ── 3D (Three.js) 状態管理 ───────────────────────────
    _3d: {
        initialized: false,
        renderer: null,
        scene: null,
        camera: null,
        controls: null,
        canvas: null,
        instancedMesh: null,
        disposables: []
    },

    width: 0,
    height: 0,

    // ── 1. 統合初期化 (破壊ゼロの永続化アーキテクチャ) ────────
    init() {
        const container = document.getElementById("map-container");
        this.width  = container.getBoundingClientRect().width;
        this.height = container.getBoundingClientRect().height;

        // 【極大原則】DOMの破壊(innerHTML = '')を行わない
        if (!this.svg) this.init2D(container);
        if (!this._3d.initialized) this.init3D(container);

        // リサイズ時の更新処理
        this.updateDimensions();
        this.updateProjection();

        // 2Dの静的マップ（陸地）は初期化時とモード変更時にのみ再描画
        this.renderStaticMap();
    },

    init2D(container) {
        this.svg = d3.select(container).append("svg")
            .attr("class", "map-2d-layer")
            .style("position", "absolute")
            .style("top", "0").style("left", "0")
            .style("z-index", "1");

        this.svg.append("defs");
        this.g = this.svg.append("g");

        // 【削除】ここにあった const drag = d3.drag()... のGlobe回転ブロックを完全に削除しました

        this.zoomBehavior = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", (event) => {
                // 【削除】if (STATE.mapMode !== 'flat') return; のストッパーを削除
                this.g.attr("transform", event.transform);
                const k = event.transform.k;
                this.g.selectAll(".land, .graticule").attr("stroke-width", 0.5 / k);
                this.g.selectAll(".trade-arc").attr("stroke-width", function() {
                    return (+d3.select(this).attr("data-original-width") || 1) / k;
                });
                this.g.selectAll(".country-node").attr("r", function() {
                    return (+d3.select(this).attr("data-original-radius") || 3) / k;
                }).attr("stroke-width", 1.5 / k);
                this.g.selectAll(".map-label").attr("font-size", (10 / Math.sqrt(k)) + "px");
            });
        this.svg.call(this.zoomBehavior);
    },
    init3D(container) {
        if (!window.THREE) return;

        const canvas = document.createElement('canvas');
        canvas.id = 'three-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '2';
        canvas.style.pointerEvents = 'none';
        container.appendChild(canvas);

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        
        const scene = new THREE.Scene();
        
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(this.width * 0.3, 800, this.height * 0.4);
        scene.add(dirLight);

        const camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1, 100000);
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;

        const animate = () => {
            requestAnimationFrame(animate);
            if (canvas.style.display !== 'none') {
                controls.update();
                renderer.render(scene, camera);
            }
        };
        animate();

        this._3d = {
            initialized: true,
            renderer, scene, camera, controls, canvas,
            instancedMesh: null,
            disposables: []
        };
    },

    updateDimensions() {
        this.svg
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .style("background", "#F0F4F8"); // 常にFlat用の背景色に固定

        if (this._3d.initialized) {
            this._3d.renderer.setSize(this.width, this.height);
            this._3d.camera.aspect = this.width / this.height;
            this._3d.camera.updateProjectionMatrix();
        }
    },

    updateProjection() {
        // Globe(Orthographic)の条件分岐を完全に削除
        this.projection = d3.geoEquirectangular()
            .scale(this.width / 6.5)
            .translate([this.width / 2, this.height / 1.8]);
            
        this.path = d3.geoPath().projection(this.projection);
    },

    zoomToRegion(regionName) {
        if (STATE.metric === 'weight') {
            if (this._3d.initialized) {
                this.flyCameraToRegion3D(regionName);
            }
            return;
        }

        if (!this.zoomBehavior) return;

        const config = RegionConfig.regions[regionName];
        if (!config) return;

        const [targetLon, targetLat] = config.center;
        const targetScale = config.scale;

        const projectedPoint = this.projection([targetLon, targetLat]);
        if (!projectedPoint) return;

        const k = targetScale;
        const tx = (this.width / 2) - (projectedPoint[0] * k);
        const ty = (this.height / 2) - (projectedPoint[1] * k);

        const transform = d3.zoomIdentity.translate(tx, ty).scale(k);

        this.svg.transition()
            .duration(1200)
            .call(this.zoomBehavior.transform, transform);
    },

    flyCameraToRegion3D(region) {
        const { camera, controls } = this._3d;
        const W = this.width;
        const H = this.height;

        const rig = {
            "Global":   { target: [0, 0, 0],                 pos: [0, -H * 0.45, Math.max(W, H) * 0.67] },
            "Africa":   { target: [W * 0.05, -H * 0.05, 0],  pos: [W * 0.05,  -H * 0.35, H * 0.25] },
            "Europe":   { target: [W * 0.02,  H * 0.2,   0], pos: [W * 0.02,   H * 0.05, H * 0.2]  },
            "Asia":     { target: [W * 0.2,   H * 0.1,   0], pos: [W * 0.2,  -H * 0.25,  H * 0.45] },
            "Americas": { target: [-W * 0.25, H * 0.05,  0], pos: [-W * 0.25, -H * 0.3,  H * 0.45] },
            "Oceania":  { target: [W * 0.35, -H * 0.2,   0], pos: [W * 0.35, -H * 0.4,  H * 0.25] },
        };

        const dest = rig[region] || rig["Global"];
        const startTarget = controls.target.clone();
        const endTarget   = new THREE.Vector3(...dest.target);
        const startPos    = camera.position.clone();
        const endPos      = new THREE.Vector3(...dest.pos);

        d3.transition("cameraFly")
            .duration(1500)
            .ease(d3.easeCubicInOut)
            .tween("cameraFly", () => (t) => {
                controls.target.lerpVectors(startTarget, endTarget, t);
                camera.position.lerpVectors(startPos, endPos, t);
                controls.update();
            });
    },

    flyCamera3DPreset(preset) {
        if (!this._3d.initialized) return;
        const { camera, controls } = this._3d;
        const W = this.width;
        const H = this.height;

        const rigs = {
            'global':   { target: [0, 0, 0],                  pos: [0, -H * 0.45, Math.max(W, H) * 0.67] },
            'aerial':   { target: [0, 0, 0],                  pos: [0, 0,          Math.max(W, H) * 0.85] },
            'horizon':  { target: [0, 0, 30],                 pos: [0, -H * 0.65,  H * 0.12] },
            'atlantic': { target: [-W * 0.08, -H * 0.05, 0], pos: [-W * 0.08, -H * 0.4, H * 0.65] },
            'pacific':  { target: [W * 0.18,  -H * 0.05, 0], pos: [W * 0.18,  -H * 0.38, H * 0.62] },
        };

        const dest = rigs[preset] || rigs['global'];
        const startTarget = controls.target.clone();
        const endTarget   = new THREE.Vector3(...dest.target);
        const startPos    = camera.position.clone();
        const endPos      = new THREE.Vector3(...dest.pos);

        d3.transition("cameraFly")
            .duration(1200)
            .ease(d3.easeCubicInOut)
            .tween("cameraFly", () => (t) => {
                controls.target.lerpVectors(startTarget, endTarget, t);
                camera.position.lerpVectors(startPos, endPos, t);
                controls.update();
            });
    },

    toggleOrbit() {
        if (!this._3d.initialized) return false;
        const { controls } = this._3d;
        controls.autoRotate = !controls.autoRotate;
        if (controls.autoRotate) controls.autoRotateSpeed = 0.4;
        return controls.autoRotate;
    },

    // ── 6. 静的マップ（陸地）の Data Join 実装 (バグ修正版) ──
    renderStaticMap() {
        if (!STATE.geoData || !this.g) return;

        // 陸地レイヤーを取得、なければ作成。
        let landLayer = this.g.select(".land-layer");
        if (landLayer.empty()) {
            landLayer = this.g.insert("g", ":first-child") // 必ずgコンテナの「最初の子」として挿入（最下層）
                .attr("class", "land-layer");
        }

        const graticule = d3.geoGraticule();
        
        // --- グラティチュード（経緯線）の Data Join ---
        const graticulePath = landLayer.selectAll(".graticule")
            .data([graticule()]); // 単一データを配列で渡す

        // 陸地レイヤー作成時に一度だけ追加
        graticulePath.enter().append("path")
            .attr("class", "graticule")
            .attr("fill", "none")
            .attr("stroke", "#E2E8F0")
            .attr("stroke-width", 0.5)
            .attr("stroke-opacity", 0.8)
            .merge(graticulePath) // UPDATEフェーズ（Globeドラッグ時などに再描画）
            .attr("d", this.path);

        // --- 陸地ポリゴンの Data Join ---
        const lands = landLayer.selectAll("path.land")
            .data(STATE.geoData.features, d => d.properties.id || d.id); // 厳格なキー紐付け

        // EXIT (不要な陸地を消す - 地図データ変更時に対応)
        lands.exit().remove();

        // ENTER (新しい陸地を作る)
        const landsEnter = lands.enter().append("path")
            .attr("class", "land")
            .attr("stroke", "#CBD5E0")
            .attr("stroke-width", 0.5)
            .style("transition", "fill 0.2s ease") // ホバー時のCSSアニメーション
            .on("mouseover", function() { d3.select(this).attr("fill", "#E2E8F0"); })
            .on("mouseout",  function() { d3.select(this).attr("fill", "#FAFAFA"); });

        // UPDATE + ENTER (既存の陸地を更新)
        landsEnter.merge(lands)
            .attr("fill", "#FAFAFA")
            .attr("d", this.path); // Globeドラッグ時はここを通って再描画
    },

    // ── 4. ルーティング (トラフィックコントローラー) ────────────
    renderFlows() {
        if (!this.svg) return;

        const isWeightMode = (STATE.metric === 'weight');

        // 3D コントロールパネルの表示切り替え
        const view3dPanel = document.getElementById('view3d-panel');
        if (view3dPanel) view3dPanel.classList.toggle('hidden', !isWeightMode);

        if (isWeightMode) {
            this.svg.style("display", "none");
            if (this._3d.canvas) {
                this._3d.canvas.style.display = "block";
                this._3d.canvas.style.pointerEvents = "auto";
            }
            if (this.render3DFlows) this.render3DFlows();
        } else {
            if (this._3d.canvas) {
                this._3d.canvas.style.display = "none";
                this._3d.canvas.style.pointerEvents = "none";
            }
            const overlay = document.getElementById('hit-overlay-svg');
            if (overlay) overlay.style.display = 'none';
            this.svg.style("display", "block");
            if (this.render2DFlows) this.render2DFlows();
        }
    },

    // ── 5. 2D (D3.js) Data Join アーキテクチャ ───────────────
    render2DFlows() {
        if (!this.g) return;

        // 【極大原則】この2D関数は Export Value (金額) モード専用とする。
        // 単価 (Cost/kg) は将来的に別表現にするため、ここでは描画をキャンセルして画面をクリアする。
        if (STATE.metric !== 'value') {
            this.g.selectAll(".trade-arc, .country-node, .map-label-unified")
                .transition().duration(500).style("opacity", 0).remove();
            return;
        }

        const netFlows  = STATE.filteredData;
        const nodeStats = STATE.nodeStats;

        if (!netFlows || netFlows.length === 0) {
            this.g.selectAll(".trade-arc, .country-node, .map-label-unified")
                .transition().duration(500).style("opacity", 0).remove();
            if (this.renderLegend) this.renderLegend();
            return;
        }

        // Zoomスケールの取得
        let currentK = 1;
        if (this.svg) {
            currentK = d3.zoomTransform(this.svg.node()).k;
        }

        // --- スケール計算 ---
        // --- 究極のスケール計算（98パーセンタイル・クリッピングと動的コントラスト） ---
        const nodeStatsArr  = Object.values(nodeStats);
        
        // ユーザーが特定の国を選択しているか（フォーカス状態）を判定
        const isFocused = STATE.selectedExporters.size > 0 || STATE.selectedImporters.size > 0;

        if (nodeStatsArr.length === 0 || netFlows.length === 0) return;

        // 【極大原則】外れ値によるスケール崩壊を防ぐための配列ソート
        const sortedGross   = nodeStatsArr.map(d => d.grossVolume).sort(d3.ascending);
        const sortedNetBal  = nodeStatsArr.map(d => Math.abs(d.netBalance)).sort(d3.ascending);
        const sortedNetFlows= netFlows.map(d => d.netValue).sort(d3.ascending);

        // データ分布の98パーセンタイル（上位2%）をドメインの上限として抽出
        const p98Gross      = d3.quantile(sortedGross, 0.98) || d3.max(sortedGross) || 1;
        const p98NetBal     = d3.quantile(sortedNetBal, 0.98) || d3.max(sortedNetBal) || 1;
        const p98NetFlows   = d3.quantile(sortedNetFlows, 0.98) || d3.max(sortedNetFlows) || 1;

        // 1. ノード半径（円の大きさ）
        // 上限をp98Grossに設定。超過する巨大ハブは上限値に固定 (clamp)
        const radiusScale = d3.scaleSqrt()
            .domain([0, p98Gross])
            .range(isFocused ? [3, 30] : [1.5, 20])
            .clamp(true);

        // 2. 線の太さ
        // 平方根スケール。上限をp98NetFlowsに設定。
        // グローバル時は極細(0.5px)から太線(12px)へ。フォーカス時は力強く(1.5pxから18px)へ。
        const edgeWidthScale = d3.scaleSqrt()
            .domain([0, p98NetFlows])
            .range(isFocused ? [1.5, 18.0] : [0.5, 12.0])
            .clamp(true);

        // 3. 線の透明度（スパゲッティ化の防波堤）
        // リニアスケール。上限をp98NetFlowsに設定。
        // グローバル時の最小透明度を0.05（5%）に設定し、背景の星雲として機能させる。上限は0.85。
        const opacityScale = d3.scaleLinear()
            .domain([0, p98NetFlows])
            .range(isFocused ? [0.3, 0.95] : [0.15, 0.85])
            .clamp(true);

        // 4. ノードの色（純収支グラデーション）
        const colorScale = (val) => {
            const transformed    = Math.sign(val) * Math.sqrt(Math.abs(val));
            const maxTransformed = Math.sqrt(p98NetBal); // 色の基準も98%でクリップ
            return d3.scaleLinear()
                .domain([-maxTransformed, -maxTransformed * 0.15, 0, maxTransformed * 0.15, maxTransformed])
                .range(["#e11d48", "#fb7185", "#ffffff", "#38bdf8", "#0284c7"])
                .interpolate(d3.interpolateHcl)
                .clamp(true)(transformed);
        };

        // --- レイヤー管理（Z-Indexの保証） ---
        // 陸地(.land-group) -> 線(.flow-layer) -> ノード(.node-layer) -> ラベル(.label-layer) の順で重ねる
        let flowLayer = this.g.select(".flow-layer");
        if (flowLayer.empty()) flowLayer = this.g.append("g").attr("class", "flow-layer");

        let nodeLayer = this.g.select(".node-layer");
        if (nodeLayer.empty()) nodeLayer = this.g.append("g").attr("class", "node-layer");

        let labelLayer = this.g.select(".label-layer");
        if (labelLayer.empty()) labelLayer = this.g.append("g").attr("class", "label-layer");

        // --- 1. エッジ（線）の Data Join ---
        const visibleFlows = netFlows.filter(d => {
            const s = STATE.countryCoords[d.exporter];
            const t = STATE.countryCoords[d.importer];
            if (!s || !t) return false;
            // Flatモード時、太平洋をまたぐ線が画面を横断するのを防ぐ
            //if (STATE.mapMode === 'flat' && Math.abs(s[0] - t[0]) >= 180) return false;
            return true;
        });

        // JOIN (データの紐付け)
        const arcs = flowLayer.selectAll(".trade-arc")
            .data(visibleFlows, d => `${d.exporter}|${d.importer}`);

        // EXIT (不要になった要素を消す)
        arcs.exit()
            .transition().duration(500)
            .style("opacity", 0)
            .remove();

        // ENTER (新しい要素を作る)
        const arcsEnter = arcs.enter()
            .append("path")
            .attr("class", "trade-arc")
            .style("fill", "none")
            .style("mix-blend-mode", "multiply")
            .style("opacity", 0)
            .attr("stroke", d => CONFIG.flowColors[d.flowCategory])
            .on("click", (event, d) => { event.stopPropagation(); App.openArcModal(d.exporter, d.importer); });

        // UPDATE + ENTER (既存の要素と新しい要素をまとめて更新)
        arcsEnter.merge(arcs)
            .attr("data-original-width", d => edgeWidthScale(d.netValue))
            .transition().duration(750).ease(d3.easeCubicOut)
            .attr("d", d => {
                const s = STATE.countryCoords[d.exporter];
                const t = STATE.countryCoords[d.importer];
                if (!s || !t) return null;

                const p1 = this.projection(s);
                const p2 = this.projection(t);
                if (!p1 || !p2) return null;

                const dx = p2[0] - p1[0];
                const dy = p2[1] - p1[1];
                const dr = Math.sqrt(dx * dx + dy * dy) * 1.3;
                
                // 【極大原則】アルファベット順によるランダムな分岐を完全廃止
                // SVGのArc描画において sweep-flag を 1 に固定することで、
                // 常に起点から終点に向かって「時計回り（右カーブ）」の美しい軌道を描く
                const sweep = 1; 
                
                return `M${p1[0]},${p1[1]}A${dr},${dr} 0 0,${sweep} ${p2[0]},${p2[1]}`;
            })
            .attr("stroke", d => CONFIG.flowColors[d.flowCategory])
            // ... 以降の stroke-width 等はそのまま
            .attr("stroke-width", d => edgeWidthScale(d.netValue) / currentK)
            .style("opacity", d => opacityScale(d.netValue));

        // --- 2. ノード（円）の Data Join ---
        const activeNodes = Object.keys(nodeStats).filter(d => this.isVisible(d));

        const nodes = nodeLayer.selectAll(".country-node")
            .data(activeNodes, d => d);

        nodes.exit()
            .transition().duration(500)
            .attr("r", 0)
            .style("opacity", 0)
            .remove();

        const nodesEnter = nodes.enter()
            .append("circle")
            .attr("class", "country-node")
            .attr("stroke", "#CBD5E0")
            .style("opacity", 0)
            .on("mouseover", (event, d) => App.showTooltip(event, d))
            .on("mouseout",  () => App.hideTooltip())
            .on("click",     (event, d) => { event.stopPropagation(); App.openInsightPanel(d); });

        nodesEnter.merge(nodes)
            .attr("data-original-radius", d => radiusScale(nodeStats[d].grossVolume))
            .transition().duration(750).ease(d3.easeElasticOut)
            .attr("cx", d => this.getProjectedPoint(d)[0])
            .attr("cy", d => this.getProjectedPoint(d)[1])
            .attr("r", d => radiusScale(nodeStats[d].grossVolume) / currentK)
            .attr("fill", d => colorScale(nodeStats[d].netBalance))
            .attr("stroke-width", 1.5 / currentK)
            .style("opacity", 1);

        // --- 3. ラベルの Data Join ---
        const sortedNodes = activeNodes.slice().sort((a, b) => nodeStats[b].grossVolume - nodeStats[a].grossVolume);
        const volumeThreshold = sortedNodes.length > 15 ? nodeStats[sortedNodes[14]].grossVolume : 0;

        const isLabelVisible = (d) => {
            const isNetExporter = nodeStats[d].netBalance >= 0;
            if (isNetExporter  && !STATE.showExporterLabels) return false;
            if (!isNetExporter && !STATE.showImporterLabels) return false;
            if (currentK >= 2.5) return true;
            return nodeStats[d].grossVolume >= volumeThreshold;
        };

        const visibleLabels = activeNodes.filter(d => isLabelVisible(d));

        const labels = labelLayer.selectAll(".map-label-unified")
            .data(visibleLabels, d => d);

        labels.exit()
            .transition().duration(300)
            .style("opacity", 0)
            .remove();

        const labelsEnter = labels.enter()
            .append("text")
            .attr("class", "map-label map-label-unified")
            .style("pointer-events", "none")
            .style("opacity", 0);

        labelsEnter.merge(labels)
            .text(d => STATE.countryNames[d] || d)
            .attr("fill", d => nodeStats[d].netBalance >= 0 ? "#e2e8f0" : "#f59e0b")
            .transition().duration(750)
            .attr("x", d => this.getProjectedPoint(d)[0] + (radiusScale(nodeStats[d].grossVolume) / currentK) + 4)
            .attr("y", d => this.getProjectedPoint(d)[1] + 4)
            .attr("font-size", (10 / Math.sqrt(currentK)) + "px")
            .style("opacity", 1);

        // 凡例の更新
        if (this.renderLegend) this.renderLegend();
    },

    // ── 7. 3D (Three.js) Voxel Ziggurat Engine ───────────────
    render3DFlows() {
        const { scene, camera, renderer, canvas } = this._3d;
        if (!scene) return;

        // 1. 静的マップ（陸地ワイヤーフレーム）の維持
        if (!this._3d.staticGroup || this._3d.lastWidth !== this.width) {
            if (this._3d.staticGroup) {
                scene.remove(this._3d.staticGroup);
                this._3d.staticGroup.children.forEach(c => {
                    if (c.geometry) c.geometry.dispose();
                    if (c.material) c.material.dispose();
                });
            }
            this._3d.staticGroup = new THREE.Group();
            scene.add(this._3d.staticGroup);
            this._3d.lastWidth = this.width;

            if (STATE.geoData) {
                const allPositions = [];
                for (const feature of STATE.geoData.features) {
                    const geom = feature.geometry;
                    if (!geom) continue;
                    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
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
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            }
        }

        const netFlows = STATE.filteredData;
        if (!netFlows || netFlows.length === 0) {
            this._3d.instancedMesh = null;
            this._3d.instanceData = [];
            return;
        }

        const get3DPos = (iso) => {
            const coords = STATE.countryCoords[iso];
            if (!coords) return null;
            const p = this.projection(coords);
            if (!p) return null;
            return new THREE.Vector3(p[0] - this.width / 2, -(p[1] - this.height / 2), 0);
        };

        

        // --- 3. ボクセル事前計算 ---

        // 1 ボクセルが表す重量 (kg)。小さくすると高精細、大きくすると軽量になる
        const VALUE_PER_VOXEL = 50000;
        const MAX_VOXELS_PER_FLOW = 5000; // ブラウザクラッシュ防止の上限
        const VOXEL_SIZE = 1.0;

        // 輸入国ごとにフローをグループ化し、地層順にソート
        const STRATA_ORDER = ['south-south', 'north-south', 'south-north', 'north-north'];
        const importerGroups = {};
        
        netFlows.forEach(d => {
            if (!importerGroups[d.importer]) importerGroups[d.importer] = [];
            importerGroups[d.importer].push(d);
        });

        // 全体の必要パーティクル数をカウント
        let totalParticles = 0;
        Object.keys(importerGroups).forEach(iso => {
            // 地層の順番にソート（下から上に積むため）
            importerGroups[iso].sort((a, b) => STRATA_ORDER.indexOf(a.flowCategory) - STRATA_ORDER.indexOf(b.flowCategory));
            
            importerGroups[iso].forEach(flow => {
                const count = Math.min(MAX_VOXELS_PER_FLOW, Math.max(1, Math.floor(flow.netValue / VALUE_PER_VOXEL)));
                flow.voxelCount = count; // 計算結果を保存
                totalParticles += count;
            });
        });

        // 粒が全く無い場合は終了
        if (totalParticles === 0) return;

        // --- 4. 有機的な山（Sandpile）を形成するアルゴリズム ---
        const buildOrganicMountainLayout = (totalVoxels) => {
            const R = 4.0; // 山の最大半径
            const STEEPNESS = 1.5; // 山の険しさ
            const validCells = [];
            const heightMap = {};

            // マス目の初期化
            for (let x = -R; x <= R; x++) {
                for (let y = -R; y <= R; y++) {
                    const dist = Math.sqrt(x * x + y * y);
                    if (dist <= R + 0.2) {
                        validCells.push({ x, y, dist });
                        heightMap[`${x},${y}`] = 0;
                    }
                }
            }
            // 中心から近い順に並び替え
            validCells.sort((a, b) => a.dist - b.dist);

            const layout = [];
            for (let i = 0; i < totalVoxels; i++) {
                let minScore = Infinity;
                let bestCell = null;

                // 一番「スコア（高さ＋中心からの距離）」が低いマスを探す
                for (const cell of validCells) {
                    const z = heightMap[`${cell.x},${cell.y}`];
                    const score = z + (cell.dist * STEEPNESS);
                    if (score < minScore) { minScore = score; bestCell = cell; }
                }

                const z = heightMap[`${bestCell.x},${bestCell.y}`];
                layout.push({ dx: bestCell.x, dy: bestCell.y, dz: z });
                heightMap[`${bestCell.x},${bestCell.y}`]++; // そのマスの高さを1段上げる
            }

            // 下から上へ積み上がるようにZ軸でソート
            layout.sort((a, b) => a.dz - b.dz);
            return layout;
        };

        // --- 5. Voxel Neon Glow Engine (MeshBasicMaterial + Fresnel) ---
        //
        // ★ MeshBasicMaterial の重要制約:
        //   normal 頂点属性は USE_ENVMAP が有効なときのみバインドされる。
        //   → `normalMatrix * normal` を使うとシェーダーがコンパイル失敗するか
        //     vFakeNormal が常に vec3(0) になり Fresnel が完全に壊れる。
        //
        // ★ 修正方針:
        //   normal の代わりに position を使う。BoxGeometry の頂点座標は
        //   ±0.5 の範囲に収まり、normalize(position) はキューブの外向き法線の
        //   十分な近似になる。追加の attribute バインドが一切不要。

        const geometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);

        // 照明計算を持たない BasicMaterial でインスタンスカラーを直接出力する
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
        });

        // 【A2 ハイブリッド安定版】
        // 位置計算は頂点シェーダーに残し、黒化の本命であるフラグメント側の
        // Fresnel / Glow 改造だけを外す。これによりボクセルの配置は維持しつつ、
        // instanceColor を MeshBasicMaterial の素の色計算へ戻す。
        material.customProgramCacheKey = () => 'voxel-position-only-a2';

        const customUniforms = { time: { value: 0 } };

        material.onBeforeCompile = (shader) => {
            shader.uniforms.time = customUniforms.time;

            // --- 頂点シェーダー: アニメーション + 位置計算のみ維持 ---
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

                // 発射地点 → 着地点へ OutCubic イージングで飛翔
                float duration = 2.0;
                float progress = clamp((time - delay) / duration, 0.0, 1.0);
                progress = 1.0 - pow(1.0 - progress, 3.0);

                vec3 animatedPos = mix(startPos, targetPos, progress);

                // 放物線軌道: 飛翔中のみ Z に山なりのオフセットを加算
                float heightFac = length(targetPos - startPos) * 0.4;
                if (progress > 0.0 && progress < 1.0) {
                    animatedPos.z += heightFac * sin(progress * 3.14159265);
                }

                transformed = position + animatedPos;
                `
            );
        };

        const instancedMesh = new THREE.InstancedMesh(geometry, material, totalParticles);
        this._3d.dataGroup.add(instancedMesh);
        
        // GPUへ送る「粒固有データ」用の配列
        const startPositions = new Float32Array(totalParticles * 3);
        const targetPositions = new Float32Array(totalParticles * 3);
        const delays = new Float32Array(totalParticles);
        const instanceData = new Array(totalParticles); // ホバー用データ

        const dummyMatrix = new THREE.Matrix4();
        const dummyColor = new THREE.Color();
        let instanceIdx = 0;
        let categoryStartTime = 0;

        // 各輸入国の山を建設
        for (const [iso, flows] of Object.entries(importerGroups)) {
            const baseTargetPos = get3DPos(iso);
            if (!baseTargetPos) continue;

            const totalVoxelsForCountry = flows.reduce((sum, f) => sum + f.voxelCount, 0);
            const layout = buildOrganicMountainLayout(totalVoxelsForCountry);

            let layoutIdx = 0;
            let currentImporterDelay = categoryStartTime;

            for (const flow of flows) {
                const hexColor = CONFIG.flowColors[flow.flowCategory] || '#ffffff';
                dummyColor.set(hexColor);
                
                const startPos = get3DPos(flow.exporter);
                if (!startPos) continue;

                const flowSpread = Math.sqrt(flow.voxelCount) * 0.05; 

                for (let i = 0; i < flow.voxelCount; i++) {
                    if (layoutIdx >= layout.length) break;
                    
                    const { dx, dy, dz } = layout[layoutIdx];
                    
                    const tx = baseTargetPos.x + dx * VOXEL_SIZE;
                    const ty = baseTargetPos.y + dy * VOXEL_SIZE;
                    const tz = dz * VOXEL_SIZE + VOXEL_SIZE / 2;

                    const i3 = instanceIdx * 3;
                    
                    startPositions[i3] = startPos.x;
                    startPositions[i3+1] = startPos.y;
                    startPositions[i3+2] = startPos.z;
                    
                    targetPositions[i3] = tx;
                    targetPositions[i3+1] = ty;
                    targetPositions[i3+2] = tz;
                    
                    delays[instanceIdx] = currentImporterDelay + Math.random() * flowSpread;

                    // アニメーションの移動はシェーダー内で行うため、
                    // InstanceMatrix は単位行列のまま（移動を含めない）
                    dummyMatrix.identity();
                    instancedMesh.setMatrixAt(instanceIdx, dummyMatrix);
                    instancedMesh.setColorAt(instanceIdx, dummyColor);
                    
                    // この粒が「どこから来たか」と「どれだけの量か」を記憶
                    instanceData[instanceIdx] = {
                        importer: iso,
                        exporter: flow.exporter,
                        category: flow.flowCategory,
                        netValue: flow.netValue
                    };
                    
                    instanceIdx++;
                    layoutIdx++;
                }
                currentImporterDelay += flowSpread * 0.1;
            }
        }

        // --- 6. GPU (Shader) へデータを転送 ---

        // InstancedBufferAttribute を使用してインスタンスごとのデータを正しくバインドする
        instancedMesh.geometry.setAttribute('startPos', new THREE.InstancedBufferAttribute(startPositions, 3));
        instancedMesh.geometry.setAttribute('targetPos', new THREE.InstancedBufferAttribute(targetPositions, 3));
        instancedMesh.geometry.setAttribute('delay',    new THREE.InstancedBufferAttribute(delays, 1));

        // CPU による誤った画面外カリングを無効化し、シェーダー側のアニメーションを妨げない
        instancedMesh.frustumCulled = false;

        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        
        this._3d.instancedMesh = instancedMesh;
        this._3d.instanceData = instanceData;
        this._3d.customUniforms = customUniforms; // A2版では位置アニメーション用のみ保持

        // --- 7. 透明ヒットエリア・オーバーレイ（ホバーツールチップ） ---
        this._build3DHitOverlay(importerGroups);

        if (this.render3DLegend) this.render3DLegend();

        // --- 8. アニメーション・ループの開始（クリーン版） ---
        
        if (this._3d.animationFrameId) {
            cancelAnimationFrame(this._3d.animationFrameId);
        }

        const startTime = performance.now();

        const animateVoxelTime = () => {
            if (STATE.metric !== 'weight' || !this._3d.customUniforms) return;
            
            // 時間の更新のみを行う（描画は main のループに任せる）
            const elapsedTime = (performance.now() - startTime) / 1000;
            this._3d.customUniforms.time.value = elapsedTime;
            
            this._3d.animationFrameId = requestAnimationFrame(animateVoxelTime);
        };
        
        animateVoxelTime();

    },

    // ── 透明ヒットエリア・オーバーレイ ──────────────────────────
    _build3DHitOverlay(importerGroups) {
        const container = document.getElementById('map-container');
        const { camera, controls } = this._3d;

        // オーバーレイSVGの取得 or 作成
        let overlaySvg = document.getElementById('hit-overlay-svg');
        if (!overlaySvg) {
            overlaySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            overlaySvg.id = 'hit-overlay-svg';
            overlaySvg.style.position = 'absolute';
            overlaySvg.style.top = '0';
            overlaySvg.style.left = '0';
            overlaySvg.style.width = '100%';
            overlaySvg.style.height = '100%';
            overlaySvg.style.zIndex = '3';
            overlaySvg.style.pointerEvents = 'none';
            container.appendChild(overlaySvg);
        }
        overlaySvg.innerHTML = '';
        overlaySvg.style.display = 'block';

        // 各輸入国のヒットゾーンデータを構築
        const hitZones = [];

        for (const [iso] of Object.entries(importerGroups)) {
            const coords = STATE.countryCoords[iso];
            if (!coords) continue;
            const p = this.projection(coords);
            if (!p) continue;

            // 3Dワールド座標（国の地面位置）
            const worldPos = new THREE.Vector3(
                p[0] - this.width / 2,
                -(p[1] - this.height / 2),
                0
            );

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', '12');
            circle.setAttribute('fill', 'transparent');
            circle.setAttribute('stroke', 'none');
            circle.style.pointerEvents = 'all';
            circle.style.cursor = 'pointer';

            // ホバーイベント — delegate to App's rich tooltip
            circle.addEventListener('mouseenter', (event) => {
                App.showTooltip(event, iso);
            });

            circle.addEventListener('mousemove', (event) => {
                const tooltip = document.getElementById('tooltip');
                App._positionTooltip(tooltip, event);
            });

            circle.addEventListener('mouseleave', () => {
                App.hideTooltip();
            });

            circle.addEventListener('click', (event) => {
                event.stopPropagation();
                App.openInsightPanel(iso);
            });

            overlaySvg.appendChild(circle);
            hitZones.push({ circle, worldPos });
        }

        // ワールド座標 → スクリーン座標の投影関数
        const projectToScreen = () => {
            // camera.position.set() 後にmatrixWorldInverseを強制更新する
            // これをしないと初回呼び出し時にprojected.z = Infinityになり全円がdisplay:noneになる
            camera.updateMatrixWorld(true);
            const w = this.width;
            const h = this.height;
            hitZones.forEach(({ circle, worldPos }) => {
                const projected = worldPos.clone().project(camera);
                const sx = (projected.x * 0.5 + 0.5) * w;
                const sy = (-projected.y * 0.5 + 0.5) * h;
                circle.setAttribute('cx', sx);
                circle.setAttribute('cy', sy);

                // カメラの背面にある場合は非表示
                circle.style.display = projected.z > 1 ? 'none' : '';
            });
        };

        // 初回投影
        projectToScreen();

        // カメラ移動時に再投影（前回のリスナーを解除してから登録）
        if (this._3d._hitOverlayListener) {
            controls.removeEventListener('change', this._3d._hitOverlayListener);
        }
        this._3d._hitOverlayListener = projectToScreen;
        controls.addEventListener('change', projectToScreen);
    },

    // ── Legend for the 3D Weight view ────────────────────────────
    render3DLegend() {
        const titleEl = document.getElementById('legend-title');
        if (titleEl) titleEl.innerText = 'Weight (3D View)';

        const container = document.getElementById('legend-content');
        if (!container) return;

        const categories = [
            { key: 'north-south', label: 'North \u2192 South' },
            { key: 'south-north', label: 'South \u2192 North' },
            { key: 'south-south', label: 'South \u2192 South' },
            { key: 'north-north', label: 'North \u2192 North' },
        ];

        container.innerHTML = `
            <div class="space-y-2 mt-2">
                <div class="text-[9px] text-[#718096] italic mb-2">1 voxel = 50,000 kg</div>
                ${categories.map(c => `
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-sm flex-shrink-0" style="background:${CONFIG.flowColors[c.key]}"></span>
                        <span class="text-[10px] text-[#374151]">${c.label}</span>
                    </div>
                `).join('')}
            </div>
            <div class="mt-3 pt-2 border-t border-[#E2E8F0] text-[9px] text-[#718096] space-y-0.5">
                <div>Drag \u2022 Scroll to zoom</div>
                <div>Hover voxel for details</div>
            </div>`;

// ★修正: $（ドル）を外し、kg（またはTons）の単位を正確に付与する
        const total     = d3.sum(STATE.filteredData, d => d.netValue);
        const statEl    = document.getElementById('stat-value');
        const statLabel = document.querySelector('#total-stats p:first-child');
        
        // 1000kg = 1 Ton なので、数値をTon換算して表示するとより直感的です
        const totalTons = total / 1000; 
        if (statEl)    statEl.innerText = d3.format(',.0f')(totalTons) + ' Tons';
        if (statLabel) statLabel.textContent = 'Total Mass (Net)';
    },

    getProjectedPoint(iso) {
        const coords = STATE.countryCoords[iso];
        if (!coords) return [-999, -999];
        return this.projection(coords) || [-999, -999];
    },

    isVisible(iso) {
        // 【極大原則】地球の裏側判定（亡霊）を完全排除。座標が存在すれば常に表示する。
        return !!STATE.countryCoords[iso];
    },

    renderLegend() {
        const container = document.getElementById('legend-content');
        if (!container) return;

        const titleEl = document.getElementById('legend-title');
        if (titleEl) titleEl.innerText = 'Export Value ($)';

        const netFlows  = STATE.filteredData || [];
        const nodeStats = STATE.nodeStats || {};
        const fmt       = d3.format(",.0f");
        const fmtShort  = (v) => { const a = Math.abs(v); const s = v < 0 ? '-' : ''; if (a >= 1e9) return s + d3.format('.2f')(a / 1e9) + 'B'; if (a >= 1e6) return s + d3.format('.2f')(a / 1e6) + 'M'; if (a >= 1e3) return s + d3.format('.2f')(a / 1e3) + 'K'; return s + d3.format(',.0f')(a); };

        // --- 1. Flow Categories (arc colors) — filtered dynamically ---
        const categories = [
            { key: 'north-south', label: 'North \u2192 South', abbr: 'N\u2192S' },
            { key: 'south-north', label: 'South \u2192 North', abbr: 'S\u2192N' },
            { key: 'south-south', label: 'South \u2192 South', abbr: 'S\u2192S' },
            { key: 'north-north', label: 'North \u2192 North', abbr: 'N\u2192N' },
        ];

        // Compute per-category stats from current filtered data
        const catStats = {};
        categories.forEach(c => { catStats[c.key] = { count: 0, total: 0 }; });
        netFlows.forEach(d => {
            if (catStats[d.flowCategory]) {
                catStats[d.flowCategory].count++;
                catStats[d.flowCategory].total += d.netValue;
            }
        });

        const catHtml = categories.map(c => {
            const active = STATE.flowFilters.has(c.key);
            const stat   = catStats[c.key];
            const opacity = active ? '1' : '0.25';
            const valueStr = stat.count > 0 ? `$${fmtShort(stat.total)}` : '\u2014';
            const countStr = stat.count > 0 ? `${stat.count}` : '0';
            return `
                <div class="flex items-center gap-2" style="opacity:${opacity}">
                    <span class="w-3 h-1 rounded-full flex-shrink-0" style="background:${CONFIG.flowColors[c.key]}"></span>
                    <span class="flex-1 text-[10px] text-[#374151]">${c.label}</span>
                    <span class="text-[9px] text-[#718096] font-mono">${countStr}</span>
                    <span class="text-[9px] text-[#718096] font-mono w-12 text-right">${valueStr}</span>
                </div>`;
        }).join('');

        // --- 2. Arc width explanation ---
        const widthHtml = `
            <div class="text-[9px] text-[#718096] italic mt-1">Arc width = net trade value</div>`;

        // --- 3. Node visualization (circle size + color) ---
        const nodeHtml = `
            <div class="mt-3 pt-2 border-t border-[#E2E8F0]">
                <div class="text-[10px] text-[#718096] font-bold uppercase mb-1.5 tracking-wider">Nodes</div>
                <div class="flex items-center justify-center gap-0.5 my-2" style="height:28px">
                    <div style="width:22px;height:22px;border-radius:50%;background:#e11d48" title="Strong net importer"></div>
                    <div style="width:16px;height:16px;border-radius:50%;background:#fb7185" title="Net importer"></div>
                    <div style="width:10px;height:10px;border-radius:50%;background:#f9a8d4" title="Slight net importer"></div>
                    <div style="width:5px;height:5px;border-radius:50%;background:#9CA3AF;border:1px solid #CBD5E0" title="Balanced"></div>
                    <div style="width:10px;height:10px;border-radius:50%;background:#7dd3fc" title="Slight net exporter"></div>
                    <div style="width:16px;height:16px;border-radius:50%;background:#38bdf8" title="Net exporter"></div>
                    <div style="width:22px;height:22px;border-radius:50%;background:#0284c7" title="Strong net exporter"></div>
                </div>
                <div class="flex justify-between text-[9px] text-[#718096] font-mono">
                    <span>← Net importer</span>
                    <span>Net exporter →</span>
                </div>
                <div class="text-[9px] text-[#718096] italic mt-1">Color = net balance · Size = gross volume</div>
            </div>`;

        // --- 4. Visibility Threshold ---
        const isManualThreshold = STATE.thresholdMode !== 'auto';
        let currentThreshold, autoZoomLevel;

        if (isManualThreshold) {
            currentThreshold = STATE.thresholdMode;
            autoZoomLevel = null; // 手動モードではautoレベル表示なし
        } else {
            const totalSelected    = STATE.selectedExporters.size + STATE.selectedImporters.size;
            const isCountryFocused = totalSelected > 0 && totalSelected <= 5;
            const isGroupFocused   = totalSelected > 5;
            const isRegionFocused  = STATE.region && STATE.region !== 'Global';
            if (isCountryFocused) {
                currentThreshold = 10000;  autoZoomLevel = 'Country';
            } else if (isGroupFocused || isRegionFocused) {
                currentThreshold = 100000; autoZoomLevel = 'Group';
            } else {
                currentThreshold = 500000; autoZoomLevel = 'Global';
            }
        }

        const modeBadge = isManualThreshold
            ? '<span class="text-[8px] bg-amber-100 text-amber-700 border border-amber-200 px-1 rounded font-bold">MANUAL</span>'
            : '<span class="text-[8px] bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD] px-1 rounded font-bold">AUTO</span>';

        // Auto階層表示（手動時は非表示）
        const autoTiersHtml = isManualThreshold ? '' : `
                <div class="space-y-0.5 mt-1.5">
                    <div class="flex items-center gap-1.5 text-[9px] ${autoZoomLevel === 'Global'  ? 'text-[#004990] font-bold' : 'text-[#718096]'}">
                        <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${autoZoomLevel === 'Global'  ? 'bg-[#004990]' : 'bg-[#CBD5E0]'}"></span>
                        <span class="flex-1">Global</span><span class="font-mono">$500k</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-[9px] ${autoZoomLevel === 'Group'   ? 'text-[#004990] font-bold' : 'text-[#718096]'}">
                        <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${autoZoomLevel === 'Group'   ? 'bg-[#004990]' : 'bg-[#CBD5E0]'}"></span>
                        <span class="flex-1">Region / Group (6+)</span><span class="font-mono">$100k</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-[9px] ${autoZoomLevel === 'Country' ? 'text-[#004990] font-bold' : 'text-[#718096]'}">
                        <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${autoZoomLevel === 'Country' ? 'bg-[#004990]' : 'bg-[#CBD5E0]'}"></span>
                        <span class="flex-1">Country (1–5)</span><span class="font-mono">$10k</span>
                    </div>
                </div>`;

        const thresholdHtml = `
            <div class="mt-2 pt-2 border-t border-[#E2E8F0]">
                <div class="flex items-center justify-between mb-1.5">
                    <div class="text-[10px] text-[#718096] font-bold uppercase tracking-wider">Threshold</div>
                    ${modeBadge}
                </div>
                <div class="flex items-center justify-between text-[10px]">
                    <span class="text-[#374151]">Min. flow</span>
                    <span class="text-[#1a2332] font-bold font-mono">$${fmtShort(currentThreshold)}</span>
                </div>
                ${autoTiersHtml}
            </div>`;

        // --- 5. Active filter context ---
        const countryCount = Object.keys(nodeStats).length;
        const flowCount    = netFlows.length;
        const regionLabel  = STATE.region && STATE.region !== 'Global' ? STATE.region : 'Global';
        const focusLabel   = STATE.selectedExporters.size > 0 || STATE.selectedImporters.size > 0
            ? `${STATE.selectedExporters.size} exp / ${STATE.selectedImporters.size} imp`
            : 'All';

        const contextHtml = `
            <div class="mt-2 pt-2 border-t border-[#E2E8F0]">
                <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
                    <span class="text-[#718096]">Region</span><span class="text-[#374151] font-mono text-right">${regionLabel}</span>
                    <span class="text-[#718096]">Selection</span><span class="text-[#374151] font-mono text-right">${focusLabel}</span>
                    <span class="text-[#718096]">Countries</span><span class="text-[#374151] font-mono text-right">${countryCount}</span>
                    <span class="text-[#718096]">Trade flows</span><span class="text-[#374151] font-mono text-right">${fmt(flowCount)}</span>
                </div>
            </div>`;

        // --- P3. Mini Distribution Histogram (log-scale bins) ---
        const histHtml = (() => {
            if (netFlows.length === 0) return '';

            // Log10 bins: from $1k to $10B (7 decades → 14 bins, 2 per decade)
            const LOG_MIN = 3, LOG_MAX = 10, BINS = 14;
            const counts = new Array(BINS).fill(0);
            const catPrimary = new Array(BINS).fill(null); // dominant category per bin
            const catCounts  = Array.from({ length: BINS }, () => ({}));

            netFlows.forEach(d => {
                const v = d.netValue;
                if (v <= 0) return;
                const log = Math.log10(v);
                let b = Math.floor((log - LOG_MIN) / (LOG_MAX - LOG_MIN) * BINS);
                b = Math.max(0, Math.min(BINS - 1, b));
                counts[b]++;
                catCounts[b][d.flowCategory] = (catCounts[b][d.flowCategory] || 0) + 1;
            });
            counts.forEach((_, b) => {
                const best = Object.entries(catCounts[b]).sort((a, b2) => b2[1] - a[1])[0];
                catPrimary[b] = best ? best[0] : 'north-north';
            });

            const maxCount = Math.max(...counts, 1);
            const W = 220, H = 36, gap = 1;
            const bw = (W - gap * (BINS - 1)) / BINS;

            // Current threshold x-position
            const threshLog = Math.log10(Math.max(currentThreshold, 1));
            const threshX   = Math.max(0, Math.min(W, (threshLog - LOG_MIN) / (LOG_MAX - LOG_MIN) * W));

            const bars = counts.map((c, i) => {
                const h  = Math.max(1, (c / maxCount) * H);
                const x  = i * (bw + gap);
                const col = c > 0 ? (CONFIG.flowColors[catPrimary[i]] || '#CBD5E0') : '#E5E7EB';
                return `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${col}" opacity="0.75"/>`;
            }).join('');

            // X-axis labels at 1 per decade
            const xLabels = [4, 6, 8, 10].map(exp => {
                const x = (exp - LOG_MIN) / (LOG_MAX - LOG_MIN) * W;
                return `<text x="${x.toFixed(1)}" y="${H + 11}" text-anchor="middle" font-size="6.5" fill="#9CA3AF" font-family="Inter,monospace">${['$10k','$100k','$1M','$10M'][exp - 4] || ''}</text>`;
            }).join('');

            return `
            <div class="mt-3 pt-2 border-t border-[#E2E8F0]">
                <div class="flex items-center justify-between mb-1">
                    <div class="text-[10px] text-[#718096] font-bold uppercase tracking-wider">Flow Distribution</div>
                    <div class="text-[9px] text-[#9CA3AF] font-mono">${netFlows.length} flows</div>
                </div>
                <svg width="${W}" height="${H + 14}" class="w-full overflow-visible">
                    ${bars}
                    <line x1="${threshX.toFixed(1)}" y1="0" x2="${threshX.toFixed(1)}" y2="${H}" stroke="#D97706" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.9"/>
                    <text x="${(threshX + 2).toFixed(1)}" y="8" font-size="6.5" fill="#D97706" font-family="Inter,monospace">min</text>
                    ${xLabels}
                </svg>
                <div class="text-[8.5px] text-[#9CA3AF] italic mt-0.5">Bar color = dominant flow type · dashed = threshold</div>
            </div>`;
        })();

        container.innerHTML = `
            <div class="space-y-1.5 mt-1">${catHtml}</div>
            ${widthHtml}
            ${nodeHtml}
            ${histHtml}
            ${thresholdHtml}
            ${contextHtml}
        `;

        // --- Total stats (bottom section in HTML) ---
        const shownTotal     = d3.sum(netFlows, d => d.netValue);
        const bilateralTotal = STATE.totalBilateral || 0;
        const coverage       = bilateralTotal > 0 ? (shownTotal / bilateralTotal * 100) : 0;

        const statEl       = document.getElementById('stat-value');
        const bilatEl      = document.getElementById('stat-bilateral');
        const coverageEl   = document.getElementById('stat-coverage');
        if (statEl)     statEl.innerText     = '$' + fmtShort(shownTotal);
        if (bilatEl)    bilatEl.innerText    = '$' + fmtShort(bilateralTotal);
        if (coverageEl) coverageEl.innerText = `${coverage.toFixed(1)}% of bilateral trade shown`;
    }
};
window.TradeMap = TradeMap