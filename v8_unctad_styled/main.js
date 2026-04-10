const App = {
    exporterSelector: null,
    importerSelector: null,

    async init() {
        STATE.selectedExporters = new Set();
        STATE.selectedImporters = new Set();
        if (!STATE.flowFilters) STATE.flowFilters = new Set(['north-south', 'south-north', 'south-south', 'north-north']);
        
        // 地域フィルタの初期化
        STATE.region = "Global";

        const success = await DataLoader.loadAll();
        if (!success) return;

        // Initialize hierarchical country selectors
        console.log('Initializing country selectors...');
        this.exporterSelector = new CountrySelector('exp', 'exp-label', 'exporter');
        this.importerSelector = new CountrySelector('imp', 'imp-label', 'importer');
        
        try {
            await this.exporterSelector.init();
            await this.importerSelector.init();
            console.log('Country selectors initialized successfully');
        } catch (error) {
            console.error('Failed to initialize country selectors:', error);
            alert('国選択機能の初期化に失敗しました。詳細はコンソールを確認してください。');
            return;
        }

        TradeMap.init();
        this.setupEventListeners();
        
        // Update selection AFTER TradeMap.init()
        this.exporterSelector.updateSelection();
        this.updateDashboard(); 
        document.getElementById('loader').classList.add('hidden');
    },

    setupEventListeners() {
        // Map Mode
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                STATE.mapMode = mode;
                this.updateUIClasses('.mode-btn', e.target);
                
                TradeMap.init(); // Re-init map for mode switch
                
                // モード切替時、もし地域が選択されていたらズームを再適用
                if (STATE.mapMode === 'flat' && STATE.region !== "Global") {
                    setTimeout(() => TradeMap.zoomToRegion(STATE.region), 100);
                }
                
                TradeMap.renderFlows();
            });
        });

        // Region Buttons
        document.querySelectorAll('.region-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const region = e.target.dataset.region;
                STATE.region = region;

                this.updateUIClasses('.region-btn', e.target);

                this.exporterSelector.setCountries([]);
                this.importerSelector.setCountries([]);

                // updateDashboard rebuilds the 3D scene synchronously, then its
                // own setTimeout fires zoomToRegion — no second setTimeout needed here.
                this.updateDashboard();
            });
        });

        // Year
        const yearSelect = document.getElementById('year-select');
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                STATE.year = +e.target.value;

                this.exporterSelector.setCountries([]);
                this.importerSelector.setCountries([]);

                this.updateDashboard();
            });
        }

        // Metric
        document.querySelectorAll('.metric-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.updateUIClasses('.metric-btn', e.target);
                STATE.metric = e.target.dataset.metric;
                this.updateThresholdVisibility();
                DataLoader.filterData();
                TradeMap.renderFlows();
                this.updateKPIBar();
            });
        });

        // Threshold toggle
        document.querySelectorAll('.threshold-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.target.dataset.threshold;
                STATE.thresholdMode = val === 'auto' ? 'auto' : +val;
                this.updateUIClasses('.threshold-btn', e.target);
                this.updateDashboard(false);
            });
        });

        // Flow category checkboxes
        document.querySelectorAll('.flow-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const val = e.target.value;
                if (e.target.checked) STATE.flowFilters.add(val);
                else STATE.flowFilters.delete(val);
                this.updateDashboard(false);
            });
        });

        // Exporter label toggle
        const expLabelToggle = document.getElementById('toggle-exp-labels');
        if (expLabelToggle) {
            expLabelToggle.addEventListener('change', (e) => {
                STATE.showExporterLabels = e.target.checked;
                TradeMap.renderFlows();
            });
        }

        // Importer label toggle
        const impLabelToggle = document.getElementById('toggle-imp-labels');
        if (impLabelToggle) {
            impLabelToggle.addEventListener('change', (e) => {
                STATE.showImporterLabels = e.target.checked;
                TradeMap.renderFlows();
            });
        }

        // --- Dropdown Logic (Exporter & Importer) ---
        this.setupHierarchicalDropdown('exp', this.exporterSelector);
        this.setupHierarchicalDropdown('imp', this.importerSelector);

        // Insight panel close button
        const panelCloseBtn = document.getElementById('panel-close-btn');
        if (panelCloseBtn) panelCloseBtn.addEventListener('click', () => this.closeInsightPanel());

        // Arc detail modal
        document.getElementById('arc-modal-close').addEventListener('click', () => this.closeArcModal());
        document.getElementById('arc-modal-backdrop').addEventListener('click', () => this.closeArcModal());

        // Compare modal
        document.getElementById('compare-modal-close').addEventListener('click', () => this.closeCompareModal());
        document.getElementById('compare-modal-backdrop').addEventListener('click', () => this.closeCompareModal());

        window.addEventListener('resize', () => {
            TradeMap.init();
            if (STATE.mapMode === 'flat' && STATE.region !== "Global") {
                // リサイズ時もズーム位置を維持
                setTimeout(() => TradeMap.zoomToRegion(STATE.region), 100);
            }
            TradeMap.renderFlows();
        });

        // 3D カメラプリセット
        document.querySelectorAll('.view3d-preset-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const preset = e.currentTarget.dataset.preset;
                TradeMap.flyCamera3DPreset(preset);
                document.querySelectorAll('.view3d-preset-btn').forEach((b) => {
                    b.classList.remove('bg-white/20', 'text-white');
                    b.classList.add('text-white/70');
                });
                e.currentTarget.classList.add('bg-white/20', 'text-white');
                e.currentTarget.classList.remove('text-white/70');
            });
        });

        // 3D オートオービット
        const orbitToggleBtn = document.getElementById('orbit-toggle');
        if (orbitToggleBtn) {
            orbitToggleBtn.addEventListener('click', () => {
                const isOrbit = TradeMap.toggleOrbit();
                orbitToggleBtn.classList.toggle('bg-white/20', isOrbit);
                orbitToggleBtn.classList.toggle('text-white', isOrbit);
                orbitToggleBtn.classList.toggle('text-white/70', !isOrbit);
                orbitToggleBtn.textContent = isOrbit ? '⟳ Stop Orbit' : '⟳ Auto Orbit';
            });
        }
    },

    setupHierarchicalDropdown(prefix, selector) {
        const btn = document.getElementById(`${prefix}-btn`);
        const menu = document.getElementById(`${prefix}-menu`);
        const search = document.getElementById(`${prefix}-search`);
        const clearAll = document.getElementById(`${prefix}-clear-all`);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const otherPrefix = prefix === 'exp' ? 'imp' : 'exp';
            document.getElementById(`${otherPrefix}-menu`).classList.add('hidden');
            menu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !btn.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });

        search.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            menu.querySelectorAll('.country-option').forEach(item => {
                const text = item.innerText.toLowerCase();
                item.style.display = text.includes(term) ? 'flex' : 'none';
            });
            // Hide/show section headers based on visible countries
            menu.querySelectorAll('.group-option').forEach(item => {
                item.style.display = term ? 'none' : 'flex';
            });
        });

        clearAll.addEventListener('click', () => {
            selector.clearAll();
        });
    },

    updateUIClasses(selector, activeEl) {
        document.querySelectorAll(selector).forEach(b => {
            b.classList.remove('bg-[#004990]', 'text-white');
            b.classList.add('text-[#4A5568]');
        });
        activeEl.classList.remove('text-[#4A5568]');
        activeEl.classList.add('bg-[#004990]', 'text-white');
    },

    updateThresholdVisibility() {
        const hidden = STATE.metric === 'weight';
        const group = document.getElementById('threshold-group');
        const divider = document.getElementById('threshold-divider');
        if (group)   group.style.display   = hidden ? 'none' : '';
        if (divider) divider.style.display = hidden ? 'none' : '';
    },

    updateKPIBar() {
        const flows = STATE.filteredData || [];
        const stats = STATE.nodeStats || {};
        const mf = METRIC_FORMAT[STATE.metric] || METRIC_FORMAT.value;

        // Total
        const total = d3.sum(flows, d => d.netValue);
        const totalEl = document.getElementById('kpi-total');
        if (totalEl) totalEl.textContent = mf.fmt(total);

        // Flows count
        const flowsEl = document.getElementById('kpi-flows');
        if (flowsEl) flowsEl.textContent = d3.format(',')(flows.length);

        // Countries count
        const countriesEl = document.getElementById('kpi-countries');
        if (countriesEl) countriesEl.textContent = Object.keys(stats).length;

        // Top exporter (highest positive netBalance)
        const topExpEl = document.getElementById('kpi-top-exp');
        if (topExpEl) {
            const sorted = Object.entries(stats).sort((a, b) => b[1].netBalance - a[1].netBalance);
            if (sorted.length > 0 && sorted[0][1].netBalance > 0) {
                const name = STATE.countryNames[sorted[0][0]] || sorted[0][0];
                topExpEl.textContent = name.length > 16 ? name.slice(0, 15) + '…' : name;
            } else {
                topExpEl.textContent = '—';
            }
        }

        // Top importer (most negative netBalance)
        const topImpEl = document.getElementById('kpi-top-imp');
        if (topImpEl) {
            const sorted = Object.entries(stats).sort((a, b) => a[1].netBalance - b[1].netBalance);
            if (sorted.length > 0 && sorted[0][1].netBalance < 0) {
                const name = STATE.countryNames[sorted[0][0]] || sorted[0][0];
                topImpEl.textContent = name.length > 16 ? name.slice(0, 15) + '…' : name;
            } else {
                topImpEl.textContent = '—';
            }
        }

        // N→S percentage
        const nsTotal = d3.sum(flows.filter(d => d.flowCategory === 'north-south'), d => d.netValue);
        const nsPctEl = document.getElementById('kpi-ns-pct');
        if (nsPctEl) nsPctEl.textContent = total > 0 ? Math.round(nsTotal / total * 100) + '%' : '—';

        // S→S percentage
        const ssTotal = d3.sum(flows.filter(d => d.flowCategory === 'south-south'), d => d.netValue);
        const ssPctEl = document.getElementById('kpi-ss-pct');
        if (ssPctEl) ssPctEl.textContent = total > 0 ? Math.round(ssTotal / total * 100) + '%' : '—';
    },

    // ── P1: Insight Side Panel ──────────────────────────────────────

    openInsightPanel(iso) {
        const name = STATE.countryNames[iso] || iso;
        const stats = STATE.nodeStats[iso];
        const mf = METRIC_FORMAT[STATE.metric] || METRIC_FORMAT.value;
        const region = RegionConfig.getRegion(iso) || 'Unknown';
        const devStatus = CONFIG.development[iso] === 'north' ? 'Developed' : 'Developing';

        document.getElementById('panel-country-name').textContent = name;
        document.getElementById('panel-country-meta').textContent = `${region} · ${devStatus} · ${STATE.year}`;
        document.getElementById('panel-body').innerHTML = this._buildPanelContent(iso, stats, mf);

        document.getElementById('insight-panel').classList.add('open');
        this._currentPanelIso = iso;
        this.hideTooltip();
    },

    closeInsightPanel() {
        document.getElementById('insight-panel').classList.remove('open');
        this._currentPanelIso = null;
    },

    // ── P2-A: Arc Detail Modal ──────────────────────────────────────

    openArcModal(expIso, impIso) {
        const expName = STATE.countryNames[expIso] || expIso;
        const impName = STATE.countryNames[impIso] || impIso;
        const mf = METRIC_FORMAT[STATE.metric] || METRIC_FORMAT.value;

        document.getElementById('arc-modal-title').textContent = `${expName}  →  ${impName}`;
        document.getElementById('arc-modal-meta').textContent = `Net exporter: ${expName} · ${STATE.year}`;
        document.getElementById('arc-modal-body').innerHTML = this._buildArcDetailContent(expIso, impIso, mf);

        const modal = document.getElementById('arc-modal');
        modal.classList.remove('hidden');
        this.hideTooltip();
    },

    closeArcModal() {
        document.getElementById('arc-modal').classList.add('hidden');
    },

    _buildArcDetailContent(expIso, impIso, mf) {
        const expName = STATE.countryNames[expIso] || expIso;
        const impName = STATE.countryNames[impIso] || impIso;

        // Collect raw bilateral data for all years
        const yearData = {};
        for (let y = 2015; y <= 2024; y++) yearData[y] = { aToB: 0, bToA: 0 };

        STATE.data.forEach(d => {
            if (!yearData[d.year]) return;
            const val = STATE.metric === 'weight' ? d.weight : d.value;
            if (val <= 0) return;
            if (d.exporter === expIso && d.importer === impIso) yearData[d.year].aToB += val;
            else if (d.exporter === impIso && d.importer === expIso) yearData[d.year].bToA += val;
        });

        const years = Object.keys(yearData).map(Number).sort();
        const nets  = years.map(y => yearData[y].aToB - yearData[y].bToA);
        const atoBs = years.map(y => yearData[y].aToB);
        const bToAs = years.map(y => yearData[y].bToA);
        const maxAbs = Math.max(...atoBs, ...bToAs, 1);

        // --- 1. Summary for current year ---
        const cy = STATE.year;
        const curAtoB = yearData[cy] ? yearData[cy].aToB : 0;
        const curBtoA = yearData[cy] ? yearData[cy].bToA : 0;
        const curNet  = curAtoB - curBtoA;
        const netCol  = curNet >= 0 ? '#38bdf8' : '#f87171';
        const netSign = curNet >= 0 ? '+' : '';
        const fc = STATE.filteredData.find(d =>
            (d.exporter === expIso && d.importer === impIso) ||
            (d.exporter === impIso && d.importer === expIso)
        );
        const flowCat = fc ? fc.flowCategory : null;
        const catLabels = { 'north-south': 'North→South', 'south-north': 'South→North', 'south-south': 'South→South', 'north-north': 'North→North' };
        const catBadge = flowCat
            ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full border" style="color:${CONFIG.flowColors[flowCat]};border-color:${CONFIG.flowColors[flowCat]}40">${catLabels[flowCat]}</span>`
            : '';

        let html = `
        <div class="grid grid-cols-3 gap-2 mb-1">
            <div class="bg-[#F0F7FF] border border-[#BFDBFE] rounded-lg px-3 py-2 text-center">
                <div class="text-[9px] text-[#0284C7] uppercase font-bold mb-0.5">${expName} →</div>
                <div class="text-sm font-bold text-[#1a2332] font-mono">${mf.fmt(curAtoB)}</div>
            </div>
            <div class="bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg px-3 py-2 text-center">
                <div class="text-[9px] text-[#718096] uppercase font-bold mb-0.5">Net (${cy})</div>
                <div class="text-sm font-bold font-mono" style="color:${netCol}">${netSign}${mf.fmt(Math.abs(curNet))}</div>
            </div>
            <div class="bg-[#FFF0F0] border border-[#FECACA] rounded-lg px-3 py-2 text-center">
                <div class="text-[9px] text-[#DC2626] uppercase font-bold mb-0.5">← ${impName}</div>
                <div class="text-sm font-bold text-[#1a2332] font-mono">${mf.fmt(curBtoA)}</div>
            </div>
        </div>
        <div class="flex justify-center mb-3">${catBadge}</div>`;

        // --- 2. Bilateral bar chart (stacked diverging) ---
        const W = 440, H = 36, barH = 14, gap = 3;
        const bw = (W - gap * (years.length - 1)) / years.length;
        const bars = years.map((y, i) => {
            const aH = Math.max(0, (atoBs[i] / maxAbs) * barH);
            const bH = Math.max(0, (bToAs[i] / maxAbs) * barH);
            const x  = i * (bw + gap);
            const isCur = y === cy;
            const yr = String(y).slice(2);
            return `
                <rect x="${x}" y="${H/2 - aH}" width="${bw}" height="${aH}" rx="1" fill="#38bdf8" opacity="${isCur ? 1 : 0.45}"/>
                <rect x="${x}" y="${H/2}" width="${bw}" height="${bH}" rx="1" fill="#f87171" opacity="${isCur ? 1 : 0.45}"/>
                ${isCur ? `<rect x="${x - 0.5}" y="2" width="${bw + 1}" height="${H - 4}" rx="2" fill="none" stroke="#60a5fa" stroke-width="1"/>` : ''}
                <text x="${x + bw/2}" y="${H + 11}" text-anchor="middle" font-size="7" fill="${isCur ? '#0077B6' : '#9CA3AF'}" font-family="Inter,monospace">${yr}</text>`;
        }).join('');

        html += `
        <div>
            <div class="text-[9px] text-[#718096] font-bold uppercase tracking-wider mb-1.5">Bilateral Trade History</div>
            <div class="flex items-center gap-3 mb-1">
                <div class="flex items-center gap-1"><div class="w-3 h-2 rounded-sm bg-sky-400 opacity-80"></div><span class="text-[9px] text-[#4A5568]">${expName} exports</span></div>
                <div class="flex items-center gap-1"><div class="w-3 h-2 rounded-sm bg-red-400 opacity-80"></div><span class="text-[9px] text-[#4A5568]">${impName} exports</span></div>
            </div>
            <svg width="${W}" height="${H + 14}" class="w-full overflow-visible">
                <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="#CBD5E0" stroke-width="0.5"/>
                ${bars}
            </svg>
        </div>`;

        // --- 3. Year-by-year table ---
        const tableRows = years.filter(y => atoBs[years.indexOf(y)] > 0 || bToAs[years.indexOf(y)] > 0).map(y => {
            const idx = years.indexOf(y);
            const net = nets[idx];
            const nCol = net >= 0 ? '#38bdf8' : '#f87171';
            const isCur = y === cy;
            return `<tr class="${isCur ? 'bg-[#EBF5FF]' : 'hover:bg-[#F5F7FA]'}">
                <td class="py-1 px-2 text-[10px] font-mono ${isCur ? 'text-[#004990] font-bold' : 'text-[#6B7280]'}">${y}</td>
                <td class="py-1 px-2 text-[10px] font-mono text-sky-600 text-right">${mf.fmt(atoBs[idx])}</td>
                <td class="py-1 px-2 text-[10px] font-mono text-red-500 text-right">${mf.fmt(bToAs[idx])}</td>
                <td class="py-1 px-2 text-[10px] font-mono text-right font-bold" style="color:${nCol}">${net >= 0 ? '+' : ''}${mf.fmt(Math.abs(net))}</td>
            </tr>`;
        }).join('');

        html += `
        <div>
            <div class="text-[9px] text-[#718096] font-bold uppercase tracking-wider mb-1.5">Year-by-Year Table</div>
            <table class="w-full border-collapse">
                <thead>
                    <tr class="border-b border-[#E2E8F0]">
                        <th class="py-1 px-2 text-[9px] text-[#718096] text-left font-bold">Year</th>
                        <th class="py-1 px-2 text-[9px] text-sky-600 text-right font-bold">${expName} →</th>
                        <th class="py-1 px-2 text-[9px] text-red-500 text-right font-bold">← ${impName}</th>
                        <th class="py-1 px-2 text-[9px] text-[#718096] text-right font-bold">Net</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>`;

        return html;
    },

    // ── P2-B: Compare Modal ─────────────────────────────────────────

    openCompareModal(isoA, isoB) {
        const nameA = STATE.countryNames[isoA] || isoA;
        const nameB = STATE.countryNames[isoB] || isoB;
        const mf = METRIC_FORMAT[STATE.metric] || METRIC_FORMAT.value;

        document.getElementById('compare-modal-title').textContent = `${nameA}  vs  ${nameB}`;
        document.getElementById('compare-modal-body').innerHTML = this._buildCompareContent(isoA, isoB, mf);

        document.getElementById('compare-modal').classList.remove('hidden');
        this.hideTooltip();
    },

    closeCompareModal() {
        document.getElementById('compare-modal').classList.add('hidden');
        this._compareIso = null;
    },

    _buildCompareContent(isoA, isoB, mf) {
        const nameA = STATE.countryNames[isoA] || isoA;
        const nameB = STATE.countryNames[isoB] || isoB;
        const statsA = STATE.nodeStats[isoA];
        const statsB = STATE.nodeStats[isoB];

        const devA = CONFIG.development[isoA] === 'north' ? 'Developed' : 'Developing';
        const devB = CONFIG.development[isoB] === 'north' ? 'Developed' : 'Developing';
        const regA = RegionConfig.getRegion(isoA) || '—';
        const regB = RegionConfig.getRegion(isoB) || '—';

        // --- Helper: yearly totals ---
        const getYearlyTotals = (iso) => {
            const t = {};
            for (let y = 2015; y <= 2024; y++) t[y] = 0;
            STATE.data.forEach(d => {
                if (d.exporter !== iso && d.importer !== iso) return;
                const val = STATE.metric === 'weight' ? d.weight : d.value;
                if (val > 0) t[d.year] = (t[d.year] || 0) + val;
            });
            return t;
        };
        const totA = getYearlyTotals(isoA);
        const totB = getYearlyTotals(isoB);
        const years = Object.keys(totA).map(Number).sort();
        const maxV  = Math.max(...years.map(y => Math.max(totA[y], totB[y])), 1);

        // --- 1. Header comparison ---
        const metricRows = [
            { label: 'Region', vA: regA, vB: regB, raw: false },
            { label: 'Status', vA: devA, vB: devB, raw: false },
            { label: 'Gross Volume', vA: statsA ? mf.fmt(statsA.grossVolume) : '—', vB: statsB ? mf.fmt(statsB.grossVolume) : '—', raw: false,
              winA: statsA && statsB ? statsA.grossVolume > statsB.grossVolume : null },
            { label: 'Net Balance', vA: statsA ? mf.fmt(Math.abs(statsA.netBalance)) : '—', vB: statsB ? mf.fmt(Math.abs(statsB.netBalance)) : '—', raw: false },
            { label: 'Role', vA: statsA ? (statsA.netBalance >= 0 ? 'Net Exporter' : 'Net Importer') : '—',
                           vB: statsB ? (statsB.netBalance >= 0 ? 'Net Exporter' : 'Net Importer') : '—', raw: false },
        ];

        const headerRows = metricRows.map(r => {
            const hlA = r.winA === true  ? 'color:#34d399' : r.winA === false ? 'color:#f87171' : '';
            const hlB = r.winA === false ? 'color:#34d399' : r.winA === true  ? 'color:#f87171' : '';
            return `<tr class="border-b border-[#F0F0F0]">
                <td class="py-1.5 px-3 text-[10px] font-mono text-right" style="${hlA}">${r.vA}</td>
                <td class="py-1.5 px-3 text-[9px] text-[#718096] text-center font-bold uppercase">${r.label}</td>
                <td class="py-1.5 px-3 text-[10px] font-mono" style="${hlB}">${r.vB}</td>
            </tr>`;
        }).join('');

        let html = `
        <div class="grid grid-cols-3 gap-0 mb-4 text-center">
            <div class="py-2 bg-[#E0F2FE] rounded-l-lg border border-[#BAE6FD] border-r-0">
                <div class="text-xs font-bold text-[#0284C7]">${nameA}</div>
            </div>
            <div class="py-2 bg-[#F5F7FA] border-y border-[#E2E8F0] flex items-center justify-center">
                <span class="text-[#A0AEC0] font-bold text-sm">vs</span>
            </div>
            <div class="py-2 bg-[#FFFBEB] rounded-r-lg border border-[#FDE68A] border-l-0">
                <div class="text-xs font-bold text-[#D97706]">${nameB}</div>
            </div>
        </div>
        <table class="w-full mb-4">${headerRows}</table>`;

        // --- 2. Dual-line trend chart ---
        const W = 580, H = 60, gap = 4;
        const bw = (W - gap * (years.length - 1)) / years.length;
        const points = (arr) => years.map((y, i) => {
            const x = i * (bw + gap) + bw / 2;
            const yp = H - (arr[y] / maxV) * H;
            return `${x},${yp}`;
        }).join(' ');

        const dotsA = years.map((y, i) => {
            const x = i * (bw + gap) + bw / 2;
            const yp = H - (totA[y] / maxV) * H;
            const isCur = y === STATE.year;
            return `<circle cx="${x}" cy="${yp}" r="${isCur ? 4 : 2}" fill="${isCur ? '#38bdf8' : '#0ea5e9'}" opacity="${isCur ? 1 : 0.7}"/>`;
        }).join('');
        const dotsB = years.map((y, i) => {
            const x = i * (bw + gap) + bw / 2;
            const yp = H - (totB[y] / maxV) * H;
            const isCur = y === STATE.year;
            return `<circle cx="${x}" cy="${yp}" r="${isCur ? 4 : 2}" fill="${isCur ? '#f59e0b' : '#d97706'}" opacity="${isCur ? 1 : 0.7}"/>`;
        }).join('');
        const xLabels = years.filter((_, i) => i % 2 === 0).map(y => {
            const idx = years.indexOf(y);
            const x = idx * (bw + gap) + bw / 2;
            return `<text x="${x}" y="${H + 12}" text-anchor="middle" font-size="7" fill="#475569" font-family="Inter,monospace">${String(y).slice(2)}</text>`;
        }).join('');

        html += `
        <div class="mb-4">
            <div class="text-[9px] text-[#718096] font-bold uppercase tracking-wider mb-2">Trade Volume Trend</div>
            <div class="flex items-center gap-4 mb-1.5">
                <div class="flex items-center gap-1"><div class="w-6 h-[2px] bg-sky-500"></div><span class="text-[9px] text-[#4A5568]">${nameA}</span></div>
                <div class="flex items-center gap-1"><div class="w-6 h-[2px] bg-amber-500"></div><span class="text-[9px] text-[#4A5568]">${nameB}</span></div>
            </div>
            <svg width="${W}" height="${H + 16}" class="w-full overflow-visible">
                <polyline points="${points(totA)}" fill="none" stroke="#0ea5e9" stroke-width="1.5" opacity="0.8"/>
                <polyline points="${points(totB)}" fill="none" stroke="#d97706" stroke-width="1.5" opacity="0.8"/>
                ${dotsA}${dotsB}${xLabels}
            </svg>
        </div>`;

        // --- 3. Year-by-year side-by-side table ---
        const tableRows = years.filter(y => totA[y] > 0 || totB[y] > 0).reverse().map(y => {
            const isCur = y === STATE.year;
            const winA = totA[y] > totB[y];
            return `<tr class="${isCur ? 'bg-[#EBF5FF]' : 'hover:bg-[#F5F7FA]'}">
                <td class="py-1 px-3 text-[10px] font-mono text-right" style="color:${winA ? '#059669' : '#9CA3AF'}">${mf.fmt(totA[y])}</td>
                <td class="py-1 px-3 text-[9px] text-center font-mono ${isCur ? 'text-[#004990] font-bold' : 'text-[#718096]'}">${y}</td>
                <td class="py-1 px-3 text-[10px] font-mono" style="color:${!winA ? '#059669' : '#9CA3AF'}">${mf.fmt(totB[y])}</td>
            </tr>`;
        }).join('');

        html += `
        <div>
            <div class="text-[9px] text-[#718096] font-bold uppercase tracking-wider mb-1.5">Year-by-Year Comparison</div>
            <table class="w-full border-collapse">
                <thead>
                    <tr class="border-b border-[#E2E8F0]">
                        <th class="py-1 px-3 text-[9px] text-sky-600 text-right font-bold">${nameA}</th>
                        <th class="py-1 px-3 text-[9px] text-[#718096] text-center font-bold">Year</th>
                        <th class="py-1 px-3 text-[9px] text-amber-600 font-bold">${nameB}</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>`;

        return html;
    },

    _buildPanelContent(iso, stats, mf) {
        // Pre-compute partner data and yearly totals
        const partnerExports = {}, partnerImports = {};
        const yearlyTotals = {};
        for (let y = 2015; y <= 2024; y++) yearlyTotals[y] = 0;

        STATE.filteredData.forEach(d => {
            if (d.exporter === iso) partnerExports[d.importer] = (partnerExports[d.importer] || 0) + d.netValue;
            else if (d.importer === iso) partnerImports[d.exporter] = (partnerImports[d.exporter] || 0) + d.netValue;
        });
        STATE.data.forEach(d => {
            if (d.exporter === iso || d.importer === iso) {
                const val = STATE.metric === 'weight' ? d.weight : d.value;
                if (val > 0) yearlyTotals[d.year] = (yearlyTotals[d.year] || 0) + val;
            }
        });

        let html = '';

        // --- 1. Auto Narrative ---
        html += `<div class="bg-[#EBF5FF] border border-[#BFDBFE] rounded-lg p-3 space-y-1.5">
            <div class="text-[9px] text-[#004990] font-bold uppercase tracking-wider mb-1.5">Auto Insights</div>
            ${this._generateNarrative(iso, stats, partnerExports, partnerImports, yearlyTotals, mf)}
        </div>`;

        if (!stats) return html;

        // --- 2. Key Metrics ---
        const isExp = stats.netBalance >= 0;
        const balColor = isExp ? '#38bdf8' : '#f87171';
        const roleBg = isExp ? 'background:rgba(56,189,248,0.15);color:#38bdf8' : 'background:rgba(248,113,113,0.15);color:#f87171';
        html += `<div>
            <div class="text-[9px] text-[#718096] font-bold uppercase tracking-wider mb-2">Key Metrics (${STATE.year})</div>
            <div class="grid grid-cols-2 gap-2">
                <div class="bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg px-3 py-2">
                    <div class="text-[9px] text-[#718096] uppercase">${mf.grossLabel.replace(':','')}</div>
                    <div class="text-sm font-bold text-[#1a2332] font-mono">${mf.fmt(stats.grossVolume)}</div>
                </div>
                <div class="bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg px-3 py-2">
                    <div class="text-[9px] text-[#718096] uppercase">${mf.netLabel.replace(':','')}</div>
                    <div class="text-sm font-bold font-mono" style="color:${balColor}">${isExp ? '+' : ''}${mf.fmt(Math.abs(stats.netBalance))}</div>
                </div>
            </div>
            <div class="flex justify-center mt-2">
                <span class="text-[10px] font-bold px-3 py-1 rounded-full" style="${roleBg}">${isExp ? 'Net Exporter' : 'Net Importer'}</span>
            </div>
        </div>`;

        // --- 3. Trading Partners ---
        const allPartners = {};
        Object.entries(partnerExports).forEach(([p, v]) => { allPartners[p] = (allPartners[p] || 0) + v; });
        Object.entries(partnerImports).forEach(([p, v]) => { allPartners[p] = (allPartners[p] || 0) + v; });
        const sortedPartners = Object.entries(allPartners).sort((a, b) => b[1] - a[1]).slice(0, 10);

        if (sortedPartners.length > 0) {
            const maxPVal = sortedPartners[0][1];
            const rows = sortedPartners.map(([pIso, val], idx) => {
                const pName = STATE.countryNames[pIso] || pIso;
                const barPct = Math.round((val / maxPVal) * 100);
                const isExportTo = !!partnerExports[pIso];
                const arrow = isExportTo ? '→' : '←';
                const aColor = isExportTo ? '#38bdf8' : '#f87171';
                const arcExpIso = isExportTo ? iso : pIso;
                const arcImpIso = isExportTo ? pIso : iso;
                return `<div class="flex items-center gap-2 text-[11px] group">
                    <span class="text-[#9CA3AF] w-4 text-right flex-shrink-0 font-mono">${idx + 1}</span>
                    <span style="color:${aColor}" class="flex-shrink-0 font-bold text-xs">${arrow}</span>
                    <span class="text-[#374151] flex-1 truncate">${pName}</span>
                    <div class="w-10 h-[5px] bg-[#E5E7EB] rounded-full overflow-hidden flex-shrink-0">
                        <div class="h-full rounded-full" style="width:${barPct}%;background:${aColor};opacity:0.7"></div>
                    </div>
                    <span class="text-[#6B7280] font-mono text-[10px] w-12 text-right flex-shrink-0">${mf.fmt(val)}</span>
                    <div class="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="App.openArcModal('${arcExpIso}','${arcImpIso}')" class="text-[8px] px-1.5 py-0.5 rounded bg-[#E5E7EB] hover:bg-[#004990] text-[#4B5563] hover:text-white transition" title="Bilateral history">↗</button>
                        <button onclick="App.openCompareModal('${iso}','${pIso}')" class="text-[8px] px-1.5 py-0.5 rounded bg-[#E5E7EB] hover:bg-amber-500 text-[#4B5563] hover:text-white transition" title="Compare countries">⇄</button>
                    </div>
                </div>`;
            }).join('');
            html += `<div>
                <div class="text-[9px] text-[#718096] font-bold uppercase tracking-wider mb-2">Trading Partners</div>
                <div class="space-y-1.5">${rows}</div>
            </div>`;
        }

        // --- 4. Trade Trend Chart ---
        const years = Object.keys(yearlyTotals).map(Number).sort();
        const yVals = years.map(y => yearlyTotals[y]);
        const maxYV = Math.max(...yVals);
        if (maxYV > 0) {
            const W = 284, H = 48, gap = 2;
            const barW = (W - gap * (years.length - 1)) / years.length;
            const bars = yVals.map((v, i) => {
                const h = Math.max(2, (v / maxYV) * H);
                const x = i * (barW + gap);
                const isCur = years[i] === STATE.year;
                const yLabel = String(years[i]).slice(2);
                return `<rect x="${x}" y="${H - h}" width="${barW}" height="${h}" rx="2" fill="${isCur ? '#004990' : '#CBD5E0'}" ${isCur ? 'stroke="#0077B6" stroke-width="1"' : ''}/><text x="${x + barW / 2}" y="${H + 11}" text-anchor="middle" font-size="7" fill="${isCur ? '#0077B6' : '#9CA3AF'}" font-family="Inter,monospace">${yLabel}</text>`;
            }).join('');
            html += `<div>
                <div class="text-[9px] text-[#718096] font-bold uppercase tracking-wider mb-2">Trade Trend (2015–${STATE.year})</div>
                <svg width="${W}" height="${H + 14}" class="overflow-visible w-full">${bars}</svg>
            </div>`;
        }

        // --- 5. Flow Composition ---
        const catTotals = {};
        let countryTotal = 0;
        STATE.filteredData.forEach(d => {
            if (d.exporter === iso || d.importer === iso) {
                catTotals[d.flowCategory] = (catTotals[d.flowCategory] || 0) + d.netValue;
                countryTotal += d.netValue;
            }
        });
        if (countryTotal > 0) {
            const catFull = { 'north-south': 'North → South', 'south-north': 'South → North', 'south-south': 'South → South', 'north-north': 'North → North' };
            const segments = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, val]) => ({ cat, pct: (val / countryTotal) * 100 }));
            const barSegs = segments.map(s => `<div class="h-full" style="width:${s.pct}%;background:${CONFIG.flowColors[s.cat]}"></div>`).join('');
            const rows = segments.map(s => `<div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-sm flex-shrink-0" style="background:${CONFIG.flowColors[s.cat]}"></div>
                <span class="text-[10px] text-[#374151] flex-1">${catFull[s.cat]}</span>
                <span class="text-[10px] font-bold font-mono" style="color:${CONFIG.flowColors[s.cat]}">${Math.round(s.pct)}%</span>
            </div>`).join('');
            html += `<div>
                <div class="text-[9px] text-[#718096] font-bold uppercase tracking-wider mb-2">Flow Composition</div>
                <div class="flex h-[6px] rounded-full overflow-hidden gap-px mb-2">${barSegs}</div>
                <div class="space-y-1">${rows}</div>
            </div>`;
        }

        return html;
    },

    _generateNarrative(iso, stats, partnerExports, partnerImports, yearlyTotals, mf) {
        const name = STATE.countryNames[iso] || iso;
        const sentences = [];

        // Sentence 1: Role + true global rank (computed from unfiltered STATE.data)
        if (stats) {
            const isExp = stats.netBalance >= 0;
            const role = isExp ? 'net exporter' : 'net importer';

            // Compute gross volume per country from raw data for current year (filter-independent)
            const globalVols = {};
            STATE.data.forEach(d => {
                if (d.year !== STATE.year) return;
                const val = STATE.metric === 'weight' ? d.weight : d.value;
                if (val > 0) {
                    if (d.exporter) globalVols[d.exporter] = (globalVols[d.exporter] || 0) + val;
                    if (d.importer) globalVols[d.importer] = (globalVols[d.importer] || 0) + val;
                }
            });
            const sortedGlobal = Object.entries(globalVols).sort((a, b) => b[1] - a[1]);
            const globalRank = sortedGlobal.findIndex(([k]) => k === iso) + 1;
            const totalCountries = sortedGlobal.length;
            const rankStr = globalRank > 0 ? `ranked <strong>#${globalRank} of ${totalCountries}</strong> globally` : 'active';
            sentences.push(`<strong>${name}</strong> is a <strong>${role}</strong> of used clothing, ${rankStr} by gross trade volume in ${STATE.year} (${mf.fmt(stats.grossVolume)}).`);
        }

        // Sentence 2: YoY trend + CAGR
        const years = Object.keys(yearlyTotals).map(Number).sort();
        const curIdx = years.indexOf(STATE.year);
        if (curIdx > 0) {
            const curVal = yearlyTotals[STATE.year];
            const prevVal = yearlyTotals[years[curIdx - 1]];
            if (prevVal > 0 && curVal > 0) {
                const yoy = ((curVal - prevVal) / prevVal) * 100;
                const dir = yoy >= 0 ? 'grew' : 'declined';
                const col = yoy >= 0 ? '#34d399' : '#f87171';
                const firstNZ = years.findIndex(y => yearlyTotals[y] > 0);
                let cagrStr = '';
                if (firstNZ >= 0 && curIdx > firstNZ && yearlyTotals[years[firstNZ]] > 0) {
                    const n = curIdx - firstNZ;
                    const cagr = (Math.pow(curVal / yearlyTotals[years[firstNZ]], 1 / n) - 1) * 100;
                    if (isFinite(cagr)) cagrStr = ` (CAGR ${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}% since ${years[firstNZ]})`;
                }
                sentences.push(`Trade volumes <strong style="color:${col}">${dir} ${Math.abs(yoy).toFixed(1)}%</strong> from ${years[curIdx - 1]} to ${STATE.year}${cagrStr}.`);
            }
        }

        // Sentence 3: Top partner + dominant flow category
        const allPartners = {};
        Object.entries(partnerExports).forEach(([p, v]) => { allPartners[p] = (allPartners[p] || 0) + v; });
        Object.entries(partnerImports).forEach(([p, v]) => { allPartners[p] = (allPartners[p] || 0) + v; });
        const topEntry = Object.entries(allPartners).sort((a, b) => b[1] - a[1])[0];

        const catTotals = {};
        let countryTotal = 0;
        STATE.filteredData.forEach(d => {
            if (d.exporter === iso || d.importer === iso) {
                catTotals[d.flowCategory] = (catTotals[d.flowCategory] || 0) + d.netValue;
                countryTotal += d.netValue;
            }
        });
        const domCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
        const catFull = { 'north-south': 'North→South', 'south-north': 'South→North', 'south-south': 'South→South', 'north-north': 'North→North' };

        if (topEntry || domCat) {
            let s = '';
            if (topEntry) {
                const tpName = STATE.countryNames[topEntry[0]] || topEntry[0];
                s += `Top trading partner is <strong>${tpName}</strong>.`;
            }
            if (domCat && countryTotal > 0) {
                const domPct = Math.round((domCat[1] / countryTotal) * 100);
                const catCol = CONFIG.flowColors[domCat[0]];
                s += ` <strong style="color:${catCol}">${catFull[domCat[0]]}</strong> flows dominate at ${domPct}%.`;
            }
            if (s) sentences.push(s);
        }

        if (sentences.length === 0) return `<p class="text-[11px] text-[#9CA3AF] italic">No trade data available for this country in the current view.</p>`;
        return sentences.map(s => `<p class="text-[11px] text-[#374151] leading-relaxed">${s}</p>`).join('');
    },

    updateDashboard(rebuildMenus = true) {
        // Get selected countries from selectors
        STATE.selectedExporters = new Set(this.exporterSelector.getSelectedCountries());
        STATE.selectedImporters = new Set(this.importerSelector.getSelectedCountries());

        DataLoader.filterData();
        TradeMap.renderFlows();
        this.updateKPIBar();
        
        // After the scene is rebuilt (year / filter / region change), restore
        // the camera to the current region. renderWeightMap3D is synchronous so
        // _3d is already populated — setTimeout(0) would work, but a small delay
        // ensures the rAF loop has started before the D3 tween begins.
        // In 2D mode, zoomToRegion('Global') is a no-op, so this is always safe.
        setTimeout(() => TradeMap.zoomToRegion(STATE.region), 50);
    },

    showTooltip(event, iso) {
        const tooltip = document.getElementById('tooltip');
        const name = STATE.countryNames[iso] || iso;
        const stats = STATE.nodeStats[iso];
        const mf = METRIC_FORMAT[STATE.metric] || METRIC_FORMAT.value;

        // --- Header ---
        const region = RegionConfig.getRegion(iso);
        const devStatus = CONFIG.development[iso] === 'north' ? 'Developed' : 'Developing';
        const regionTag = region && region !== 'Other'
            ? `<span class="text-[9px] text-[#718096]">${region} · ${devStatus}</span>` : '';

        let content = `
        <div class="flex items-center justify-between gap-3 mb-1.5">
            <div class="font-bold text-[#004990] text-sm leading-tight">${name}</div>
            ${regionTag}
        </div>`;

        if (!stats) {
            tooltip.innerHTML = content;
            this._positionTooltip(tooltip, event);
            return;
        }

        // --- KPI row ---
        const isNetExporter = stats.netBalance >= 0;
        const balanceColor = isNetExporter ? '#38bdf8' : '#f87171';
        const balanceSign  = isNetExporter ? '+' : '';
        const roleLabel    = isNetExporter ? 'Net Exporter' : 'Net Importer';
        const roleBg       = isNetExporter ? 'background:rgba(56,189,248,0.15);color:#38bdf8' : 'background:rgba(248,113,113,0.15);color:#f87171';

        content += `
        <div class="grid grid-cols-2 gap-2 mb-1.5">
            <div class="bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-2 py-1.5">
                <div class="text-[9px] text-[#718096] uppercase">${mf.grossLabel.replace(':','')}</div>
                <div class="text-xs font-bold text-[#1a2332] font-mono">${mf.fmt(stats.grossVolume)}</div>
            </div>
            <div class="bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-2 py-1.5">
                <div class="text-[9px] text-[#718096] uppercase">${mf.netLabel.replace(':','')}</div>
                <div class="text-xs font-bold font-mono" style="color:${balanceColor}">${balanceSign}${mf.fmt(Math.abs(stats.netBalance))}</div>
            </div>
        </div>
        <div class="flex justify-center mb-2">
            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" style="${roleBg}">${roleLabel}</span>
        </div>`;

        // --- Top Partners (from current filtered data) ---
        const partnerExports = {};
        const partnerImports = {};
        STATE.filteredData.forEach(d => {
            if (d.exporter === iso) {
                partnerExports[d.importer] = (partnerExports[d.importer] || 0) + d.netValue;
            } else if (d.importer === iso) {
                partnerImports[d.exporter] = (partnerImports[d.exporter] || 0) + d.netValue;
            }
        });

        const allPartners = {};
        Object.entries(partnerExports).forEach(([p, v]) => { allPartners[p] = (allPartners[p] || 0) + v; });
        Object.entries(partnerImports).forEach(([p, v]) => { allPartners[p] = (allPartners[p] || 0) + v; });

        const topPartners = Object.entries(allPartners)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        if (topPartners.length > 0) {
            const maxPVal = topPartners[0][1];
            const partnerRows = topPartners.map(([pIso, val]) => {
                const pName = (STATE.countryNames[pIso] || pIso);
                const shortName = pName.length > 14 ? pName.slice(0, 13) + '…' : pName;
                const barPct = Math.round((val / maxPVal) * 100);
                const isExportTo = !!partnerExports[pIso];
                const arrow = isExportTo ? '→' : '←';
                const arrowColor = isExportTo ? '#38bdf8' : '#f87171';
                return `
                <div class="flex items-center gap-1.5 text-[10px] leading-relaxed">
                    <span style="color:${arrowColor}" class="flex-shrink-0 font-bold">${arrow}</span>
                    <span class="text-[#374151] w-[72px] truncate">${shortName}</span>
                    <div class="flex-1 h-[5px] bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div class="h-full rounded-full" style="width:${barPct}%;background:${arrowColor};opacity:0.7"></div>
                    </div>
                    <span class="text-[#6B7280] font-mono text-[9px] w-[52px] text-right">${mf.fmt(val)}</span>
                </div>`;
            }).join('');

            content += `
            <div class="pt-1.5 border-t border-[#E2E8F0]">
                <div class="text-[9px] text-[#718096] font-bold uppercase mb-1 tracking-wider">Top Partners</div>
                ${partnerRows}
            </div>`;
        }

        // --- Flow Category Breakdown ---
        const catTotals = {};
        let countryTotal = 0;
        STATE.filteredData.forEach(d => {
            if (d.exporter === iso || d.importer === iso) {
                catTotals[d.flowCategory] = (catTotals[d.flowCategory] || 0) + d.netValue;
                countryTotal += d.netValue;
            }
        });

        if (countryTotal > 0) {
            const catLabels = { 'north-south': 'N→S', 'south-north': 'S→N', 'south-south': 'S→S', 'north-north': 'N→N' };
            const segments = Object.entries(catTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, val]) => ({ cat, pct: (val / countryTotal) * 100 }));

            const barSegments = segments.map(s =>
                `<div class="h-full" style="width:${s.pct}%;background:${CONFIG.flowColors[s.cat]}"></div>`
            ).join('');
            const labelSpans = segments.map(s =>
                `<span style="color:${CONFIG.flowColors[s.cat]}" class="text-[9px] font-bold">${catLabels[s.cat]} ${Math.round(s.pct)}%</span>`
            ).join('<span class="text-[#D1D5DB] text-[9px]">·</span>');

            content += `
            <div class="mt-1.5 pt-1.5 border-t border-[#E2E8F0]">
                <div class="text-[9px] text-[#718096] font-bold uppercase mb-1 tracking-wider">Flow Composition</div>
                <div class="flex h-[4px] rounded-full overflow-hidden gap-px">${barSegments}</div>
                <div class="flex items-center justify-center gap-1 mt-1 flex-wrap">${labelSpans}</div>
            </div>`;
        }

        // --- Sparkline (yearly trend 2015-2024) ---
        const yearlyTotals = {};
        for (let y = 2015; y <= 2024; y++) yearlyTotals[y] = 0;
        STATE.data.forEach(d => {
            if (d.exporter === iso || d.importer === iso) {
                const val = STATE.metric === 'weight' ? d.weight : d.value;
                if (val > 0) yearlyTotals[d.year] = (yearlyTotals[d.year] || 0) + val;
            }
        });

        const years = Object.keys(yearlyTotals).map(Number).sort();
        const yVals = years.map(y => yearlyTotals[y]);
        const maxYV = Math.max(...yVals);

        if (maxYV > 0) {
            const W = 140, H = 28, gap = 1;
            const barW = (W - gap * (years.length - 1)) / years.length;
            const bars = yVals.map((v, i) => {
                const h = Math.max(1, (v / maxYV) * H);
                const x = i * (barW + gap);
                const isCur = years[i] === STATE.year;
                return `<rect x="${x}" y="${H - h}" width="${barW}" height="${h}" rx="1.5" fill="${isCur ? '#004990' : '#CBD5E0'}" ${isCur ? 'stroke="#0077B6" stroke-width="0.5"' : ''}/>`;
            }).join('');

            // YoY change
            const curIdx = years.indexOf(STATE.year);
            let yoyHtml = '';
            if (curIdx > 0 && yVals[curIdx - 1] > 0) {
                const yoy = ((yVals[curIdx] - yVals[curIdx - 1]) / yVals[curIdx - 1]) * 100;
                const yoyCol = yoy >= 0 ? '#34d399' : '#f87171';
                const yoySign = yoy >= 0 ? '+' : '';
                yoyHtml = `<span class="text-[9px] font-mono font-bold" style="color:${yoyCol}">${yoySign}${yoy.toFixed(0)}% YoY</span>`;
            }
            // CAGR (first non-zero to current year)
            let cagrHtml = '';
            const firstNonZeroIdx = yVals.findIndex(v => v > 0);
            if (firstNonZeroIdx >= 0 && curIdx > firstNonZeroIdx && yVals[firstNonZeroIdx] > 0 && yVals[curIdx] > 0) {
                const n = curIdx - firstNonZeroIdx;
                const cagr = (Math.pow(yVals[curIdx] / yVals[firstNonZeroIdx], 1 / n) - 1) * 100;
                if (isFinite(cagr)) {
                    const cagrCol = cagr >= 0 ? '#34d399' : '#f87171';
                    cagrHtml = `<span class="text-[8px] font-mono" style="color:${cagrCol}">CAGR ${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}%</span>`;
                }
            }

            content += `
            <div class="mt-1.5 pt-1.5 border-t border-[#E2E8F0]">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-[9px] text-[#718096] font-bold uppercase tracking-wider">Trend</span>
                    <div class="flex items-center gap-2">${yoyHtml}${cagrHtml}</div>
                </div>
                <svg width="${W}" height="${H}" class="w-full">${bars}</svg>
                <div class="flex justify-between text-[8px] text-[#9CA3AF] font-mono mt-0.5">
                    <span>${years[0]}</span><span>${years[years.length - 1]}</span>
                </div>
            </div>`;
        }

        // --- Regional Rank ---
        if (region && region !== 'Other') {
            const regionCountries = Object.entries(STATE.nodeStats)
                .filter(([code]) => RegionConfig.getRegion(code) === region)
                .sort((a, b) => b[1].grossVolume - a[1].grossVolume);
            const rank = regionCountries.findIndex(([code]) => code === iso) + 1;
            const total = regionCountries.length;
            if (rank > 0) {
                content += `
                <div class="mt-1.5 pt-1.5 border-t border-[#E2E8F0] text-[9px] text-[#718096] flex items-center gap-1">
                    <span class="text-[#004990] font-bold text-[10px]">#${rank}</span>
                    <span>of ${total} in ${region}</span>
                    <span class="ml-auto px-1.5 py-0.5 rounded text-[8px] font-bold" style="${roleBg}">${roleLabel}</span>
                </div>`;
            }
        }

        tooltip.innerHTML = content;
        this._positionTooltip(tooltip, event);
    },

    _positionTooltip(tooltip, event) {
        tooltip.style.display = 'block';
        const pad = 15;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let x = event.pageX + pad;
        let y = event.pageY - pad;
        // Measure after making visible
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        if (x + tw > vw - pad) x = event.pageX - tw - pad;
        if (y + th > vh - pad) y = vh - th - pad;
        if (y < pad) y = pad;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    },

    hideTooltip() {
        document.getElementById('tooltip').style.display = 'none';
    }
};

// Export App to window for CountrySelector
window.App = App;

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});