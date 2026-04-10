const DataLoader = {

    // BACI country name → ISO Alpha-3 mapping
    nameToISO: {
        "Afghanistan": "AFG", "Albania": "ALB", "Algeria": "DZA",
        "American Samoa": "ASM", "Andorra": "AND", "Angola": "AGO",
        "Anguilla": "AIA", "Antarctica": "ATA", "Antigua and Barbuda": "ATG",
        "Argentina": "ARG", "Armenia": "ARM", "Aruba": "ABW",
        "Australia": "AUS", "Austria": "AUT", "Azerbaijan": "AZE",
        "Bahamas": "BHS", "Bahrain": "BHR", "Bangladesh": "BGD",
        "Barbados": "BRB", "Belarus": "BLR", "Belgium": "BEL",
        "Belize": "BLZ", "Benin": "BEN", "Bermuda": "BMU",
        "Bhutan": "BTN", "Bolivia (Plurinational State of)": "BOL",
        "Bonaire": "BES", "Bosnia Herzegovina": "BIH", "Botswana": "BWA",
        "Bouvet Island": "BVT", "Br. Indian Ocean Terr.": "IOT",
        "Br. Virgin Isds": "VGB", "Brazil": "BRA", "Brunei Darussalam": "BRN",
        "Bulgaria": "BGR", "Burkina Faso": "BFA", "Burundi": "BDI",
        "Cabo Verde": "CPV", "Cambodia": "KHM", "Cameroon": "CMR",
        "Canada": "CAN", "Cayman Isds": "CYM", "Central African Rep.": "CAF",
        "Chad": "TCD", "Chile": "CHL", "China": "CHN",
        "China, Hong Kong SAR": "HKG", "China, Macao SAR": "MAC",
        "Christmas Isds": "CXR", "Cocos Isds": "CCK", "Colombia": "COL",
        "Comoros": "COM", "Congo": "COG", "Cook Isds": "COK",
        "Costa Rica": "CRI", "Croatia": "HRV", "Cuba": "CUB",
        "Cyprus": "CYP", "Czechia": "CZE",
        "Dem. People's Rep. of Korea": "PRK",
        "Dem. Rep. of the Congo": "COD",
        "Denmark": "DNK", "Djibouti": "DJI", "Dominica": "DMA",
        "Dominican Rep.": "DOM", "Ecuador": "ECU", "Egypt": "EGY",
        "El Salvador": "SLV", "Equatorial Guinea": "GNQ", "Eritrea": "ERI",
        "Estonia": "EST", "Eswatini": "SWZ", "Ethiopia": "ETH",
        "FS Micronesia": "FSM", "Falkland Isds (Malvinas)": "FLK",
        "Faroe Isds": "FRO", "Fiji": "FJI", "Finland": "FIN",
        "Fr. South Antarctic Terr.": "ATF", "France": "FRA",
        "French Polynesia": "PYF", "Gabon": "GAB", "Gambia": "GMB",
        "Georgia": "GEO", "Germany": "DEU", "Ghana": "GHA",
        "Gibraltar": "GIB", "Greece": "GRC", "Greenland": "GRL",
        "Grenada": "GRD", "Guam": "GUM", "Guatemala": "GTM",
        "Guinea": "GIN", "Guinea-Bissau": "GNB", "Guyana": "GUY",
        "Haiti": "HTI", "Holy See (Vatican City State)": "VAT",
        "Honduras": "HND", "Hungary": "HUN", "Iceland": "ISL",
        "India": "IND", "Indonesia": "IDN", "Iran": "IRN",
        "Iraq": "IRQ", "Ireland": "IRL", "Israel": "ISR",
        "Italy": "ITA", "Jamaica": "JAM", "Japan": "JPN",
        "Jordan": "JOR", "Kazakhstan": "KAZ", "Kenya": "KEN",
        "Kiribati": "KIR", "Kuwait": "KWT", "Kyrgyzstan": "KGZ",
        "Lao People's Dem. Rep.": "LAO",
        "Latvia": "LVA", "Lebanon": "LBN", "Lesotho": "LSO",
        "Liberia": "LBR", "Libya": "LBY", "Lithuania": "LTU",
        "Luxembourg": "LUX", "Madagascar": "MDG", "Malawi": "MWI",
        "Malaysia": "MYS", "Maldives": "MDV", "Mali": "MLI",
        "Malta": "MLT", "Marshall Isds": "MHL", "Mauritania": "MRT",
        "Mauritius": "MUS", "Mexico": "MEX", "Mongolia": "MNG",
        "Montenegro": "MNE", "Montserrat": "MSR", "Morocco": "MAR",
        "Mozambique": "MOZ", "Myanmar": "MMR", "N. Mariana Isds": "MNP",
        "Namibia": "NAM", "Nauru": "NRU", "Nepal": "NPL",
        "Netherlands": "NLD", "New Caledonia": "NCL", "New Zealand": "NZL",
        "Nicaragua": "NIC", "Niger": "NER", "Nigeria": "NGA",
        "Niue": "NIU", "Norfolk Isds": "NFK", "North Macedonia": "MKD",
        "Norway": "NOR", "Oman": "OMN", "Pakistan": "PAK",
        "Palau": "PLW", "Panama": "PAN", "Papua New Guinea": "PNG",
        "Paraguay": "PRY", "Peru": "PER", "Philippines": "PHL",
        "Pitcairn": "PCN", "Poland": "POL", "Portugal": "PRT",
        "Qatar": "QAT", "Rep. of Korea": "KOR", "Rep. of Moldova": "MDA",
        "Romania": "ROU", "Russian Federation": "RUS", "Rwanda": "RWA",
        "Saint Helena": "SHN", "Saint Kitts and Nevis": "KNA",
        "Saint Lucia": "LCA", "Saint Pierre and Miquelon": "SPM",
        "Saint Vincent and the Grenadines": "VCT", "Samoa": "WSM",
        "San Marino": "SMR", "Sao Tome and Principe": "STP",
        "Saudi Arabia": "SAU", "Senegal": "SEN", "Serbia": "SRB",
        "Seychelles": "SYC", "Sierra Leone": "SLE", "Singapore": "SGP",
        "Sint Maarten": "SXM", "Slovakia": "SVK", "Slovenia": "SVN",
        "Solomon Isds": "SLB", "Somalia": "SOM", "South Africa": "ZAF",
        "South Georgia and the South Sandwich Islands": "SGS",
        "South Sudan": "SSD", "Spain": "ESP", "Sri Lanka": "LKA",
        "State of Palestine": "PSE", "Sudan": "SDN", "Suriname": "SUR",
        "Sweden": "SWE", "Switzerland": "CHE", "Syria": "SYR",
        "Tajikistan": "TJK", "Thailand": "THA", "Timor-Leste": "TLS",
        "Togo": "TGO", "Tokelau": "TKL", "Tonga": "TON",
        "Trinidad and Tobago": "TTO", "Tunisia": "TUN",
        "Turkmenistan": "TKM", "Turks and Caicos Isds": "TCA",
        "Tuvalu": "TUV", "USA": "USA", "Uganda": "UGA",
        "Ukraine": "UKR", "United Arab Emirates": "ARE",
        "United Kingdom": "GBR", "United Rep. of Tanzania": "TZA",
        "United States Minor Outlying Islands": "UMI",
        "Uruguay": "URY", "Uzbekistan": "UZB", "Vanuatu": "VUT",
        "Venezuela": "VEN", "Viet Nam": "VNM",
        "Wallis and Futuna Isds": "WLF", "Western Sahara": "ESH",
        "Yemen": "YEM", "Zambia": "ZMB", "Zimbabwe": "ZWE",
        // Encoding-mangled forms as read from the UTF-8 file
        "T\u00b8rkiye": "TUR", "Cura\u00c1ao": "CUW",
        "C\u00d9te d'Ivoire": "CIV", "Saint Barth\u00c8lemy": "BLM",
        // Clean Unicode fallbacks
        "T\u00fcrkiye": "TUR", "Cura\u00e7ao": "CUW",
        "C\u00f4te d'Ivoire": "CIV", "Saint Barth\u00e9lemy": "BLM",
    },

    // ▼▼▼ 補完用データ: 地図データから漏れやすい国や島国の座標定義 ▼▼▼
    fallbackData: {
        // --- 以前の追加分 ---
        "AGO": { name: "Angola", coords: [17.87, -11.20] },
        "ARM": { name: "Armenia", coords: [45.03, 40.06] },
        "ATG": { name: "Antigua and Barbuda", coords: [-61.79, 17.06] },
        "AUS": { name: "Australia", coords: [133.77, -25.27] },
        "AUT": { name: "Austria", coords: [14.55, 47.51] },
        "AZE": { name: "Azerbaijan", coords: [47.57, 40.14] },
        "BEL": { name: "Belgium", coords: [4.46, 50.50] },
        "BHR": { name: "Bahrain", coords: [50.55, 26.06] },
        "BHS": { name: "Bahamas", coords: [-77.39, 25.03] },
        "BIH": { name: "Bosnia and Herzegovina", coords: [17.67, 43.91] },
        "BMU": { name: "Bermuda", coords: [-64.75, 32.30] },
        "BOL": { name: "Bolivia", coords: [-63.58, -16.29] },
        "BRA": { name: "Brazil", coords: [-51.92, -14.23] },
        "GRD": { name: "Grenada", coords: [-61.60, 12.11] },
        "HKG": { name: "Hong Kong", coords: [114.16, 22.31] },
        "MAC": { name: "Macau", coords: [113.54, 22.19] },
        "MDV": { name: "Maldives", coords: [73.22, 3.20] },
        "MLT": { name: "Malta", coords: [14.37, 35.93] },
        "MUS": { name: "Mauritius", coords: [57.55, -20.34] },
        "SGP": { name: "Singapore", coords: [103.81, 1.35] },
        "ALB": { name: "Albania", coords: [20.17, 41.15] },
        "BLZ": { name: "Belize", coords: [-88.49, 17.18] },
        "CYM": { name: "Cayman Islands", coords: [-81.26, 19.32] },
        "MSR": { name: "Montserrat", coords: [-62.18, 16.74] },
        "SYC": { name: "Seychelles", coords: [55.49, -4.68] },
        "WSM": { name: "Samoa", coords: [-172.10, -13.75] },
        "ABW": { name: "Aruba", coords: [-69.97, 12.52] },
        "AFG": { name: "Afghanistan", coords: [67.71, 33.94] },
        "AND": { name: "Andorra", coords: [1.52, 42.51] },
        "ARG": { name: "Argentina", coords: [-63.62, -38.42] },
        "ASM": { name: "American Samoa", coords: [-170.13, -14.27] },
        "ATA": { name: "Antarctica", coords: [0.00, -82.86] },
        "BES": { name: "Bonaire, Sint Eustatius and Saba", coords: [-68.27, 12.14] },
        "BGD": { name: "Bangladesh", coords: [90.36, 23.68] },
        "BLM": { name: "Saint Barthélemy", coords: [-62.83, 17.90] },
        "BRB": { name: "Barbados", coords: [-59.54, 13.19] },
        "BRN": { name: "Brunei Darussalam", coords: [114.73, 4.53] },
        "BTN": { name: "Bhutan", coords: [90.43, 27.51] },
        "BWA": { name: "Botswana", coords: [24.68, -22.33] },
        "COK": { name: "Cook Islands", coords: [-159.78, -21.24] },
        "CPV": { name: "Cabo Verde", coords: [-24.01, 16.00] },
        "CUW": { name: "Curaçao", coords: [-68.99, 12.17] },
        "DMA": { name: "Dominica", coords: [-61.37, 15.41] },
        "DZA": { name: "Algeria", coords: [1.66, 28.03] },
        "FRO": { name: "Faroe Islands", coords: [-6.91, 61.89] },
        "FSM": { name: "Micronesia (Federated States of)", coords: [150.55, 7.42] },
        "GIB": { name: "Gibraltar", coords: [-5.35, 36.14] },
        "GUM": { name: "Guam", coords: [144.79, 13.44] },
        "IOT": { name: "British Indian Ocean Territory", coords: [71.88, -6.34] },
        "KIR": { name: "Kiribati", coords: [-168.73, -3.37] },
        "KNA": { name: "Saint Kitts and Nevis", coords: [-62.78, 17.36] },
        "LCA": { name: "Saint Lucia", coords: [-60.98, 13.91] },
        "MHL": { name: "Marshall Islands", coords: [171.18, 7.13] },
        "MNP": { name: "Northern Mariana Islands", coords: [145.67, 15.09] },
        "NIU": { name: "Niue", coords: [-169.87, -19.05] },
        "NRU": { name: "Nauru", coords: [166.93, -0.52] },
        "PLW": { name: "Palau", coords: [134.58, 7.51] },
        "PYF": { name: "French Polynesia", coords: [-149.41, -17.68] },
        "SLB": { name: "Solomon Islands", coords: [160.16, -9.65] },
        "STP": { name: "Sao Tome and Principe", coords: [6.61, 0.19] },
        "SXM": { name: "Sint Maarten", coords: [-63.06, 18.04] },
        "TCA": { name: "Turks and Caicos Islands", coords: [-71.79, 21.69] },
        "TON": { name: "Tonga", coords: [-175.20, -21.18] },
        "TUV": { name: "Tuvalu", coords: [179.14, -7.11] },
        "VCT": { name: "Saint Vincent and the Grenadines", coords: [-61.29, 12.98] },
        "VGB": { name: "British Virgin Islands", coords: [-64.64, 18.42] },
        "WLF": { name: "Wallis and Futuna", coords: [-177.16, -13.76] },
        "AIA": { name: "Anguilla", coords: [-63.06, 18.22] },
        "ATF": { name: "French Southern Territories", coords: [69.35, -49.28] },
        "CXR": { name: "Christmas Island", coords: [105.69, -10.44] },
        "FLK": { name: "Falkland Islands", coords: [-59.52, -51.79] },
        "PSE": { name: "Palestine", coords: [35.23, 31.95] },
        "SHN": { name: "Saint Helena", coords: [-5.70, -15.96] },
        "FRA": { name: "France", coords: [2.21, 46.22] },
        "SPM": { name: "Saint Pierre and Miquelon", coords: [-56.37, 46.88] }
    },

    async loadAll() {
        try {
            const [world, csv] = await Promise.all([
                d3.json(CONFIG.geoJsonUrl),
                d3.csv(CONFIG.csvFile)
            ]);
            STATE.geoData = topojson.feature(world, world.objects.countries);
            this.processGeoData(STATE.geoData);
            
            // ▼▼▼ 修正: 補完データを適用 ▼▼▼
            this.injectMissingCoordinates();

            const SPECIAL = new Set([
                'Bunkers', 'Free Zones', 'LAIA, nes',
                'Oceania, nes', 'Other Asia, nes', 'Special Categories'
            ]);

            const parseNum = (s) => {
                if (!s) return 0;
                const clean = s.trim();
                if (!clean || /^[-\s]+$/.test(clean)) return 0;
                return parseFloat(clean.replace(/,/g, '')) || 0;
            };

            const EXPORT_WEIGHT_COL  = ' Reporter Export to Trade partner Harmonized BACI Weight ';
            const EXPORT_VALUE_COL   = 'Reporter Export To Trade Partner BACI-harmonized trade value (FOB basis, robust)';
            const IMPORT_VALUE_COL   = 'Reporter Import from Trade Partner Harmonized BACI value (FOB-basis, robust)';

            // Populate coordinates from BACI's embedded lat/lon (fill gaps after fallbackData)
            const csvCoords = {};
            csv.forEach(d => {
                const rName = d.reporterDesc && d.reporterDesc.trim();
                const pName = d.partnerDesc && d.partnerDesc.trim();
                const rISO = rName ? this.nameToISO[rName] : null;
                const pISO = pName ? this.nameToISO[pName] : null;
                const rLat = parseFloat(d['Reporter Latitude']);
                const rLon = parseFloat(d['Reporter Longitude']);
                const pLat = parseFloat(d['Partner Latitude']);
                const pLon = parseFloat(d['Partner Longitude']);
                if (rISO && !isNaN(rLat) && !isNaN(rLon) && rLat !== 0 && rLon !== 0)
                    csvCoords[rISO] = [rLon, rLat];
                if (pISO && !isNaN(pLat) && !isNaN(pLon) && pLat !== 0 && pLon !== 0)
                    if (!csvCoords[pISO]) csvCoords[pISO] = [pLon, pLat];
            });
            Object.keys(csvCoords).forEach(iso => {
                if (!STATE.countryCoords[iso]) STATE.countryCoords[iso] = csvCoords[iso];
            });

            // Populate country names for all known ISO codes
            Object.entries(this.nameToISO).forEach(([name, iso]) => {
                if (!STATE.countryNames[iso]) STATE.countryNames[iso] = name;
            });

            STATE.data = csv
                .filter(d => {
                    const partner = d.partnerDesc && d.partnerDesc.trim();
                    return partner && !SPECIAL.has(partner);
                })
                .map(d => {
                    const expISO = this.nameToISO[d.reporterDesc.trim()] || '_X';
                    const impISO = this.nameToISO[d.partnerDesc.trim()]  || '_X';
                    const weight      = parseNum(d[EXPORT_WEIGHT_COL]);
                    const value       = parseNum(d[EXPORT_VALUE_COL]);
                    const importValue = parseNum(d[IMPORT_VALUE_COL]);
                    // Compute unit price from reliable export data; avoids sparse CSV column
                    const unitPrice   = (value > 0 && weight > 0) ? value / weight : 0;
                    return {
                        year: +d.Year,
                        exporter: expISO,
                        importer: impISO,
                        weight,
                        value,
                        importValue,
                        unitPrice,
                    };
                });
            return true;
        } catch (error) {
            console.error("Error:", error);
            return false;
        }
    },

    processGeoData(geoData) {
        geoData.features.forEach(feature => {
            const numericId = feature.id; 
            const alpha3 = TradeMap.isoMap[numericId];
            if (alpha3) {
                STATE.countryCoords[alpha3] = d3.geoCentroid(feature);
                STATE.countryNames[alpha3] = feature.properties.name;
            }
        });
    },

    // ▼▼▼ 新規追加メソッド: 地図にない国を強制登録 ▼▼▼
    injectMissingCoordinates() {
        Object.keys(this.fallbackData).forEach(code => {
            const data = this.fallbackData[code];
            
            // 変更点: 条件分岐を削除し、常に上書きするように変更
            // これにより、フランス(FRA)のように「重心がずれる国」も強制的に修正されます
            STATE.countryCoords[code] = data.coords;
            
            // 名前がない場合のみ名前も登録（名前は元の地図データのものでもOKなため）
            if (!STATE.countryNames[code]) {
                STATE.countryNames[code] = data.name;
            }
        });
    },

    filterData() {
        // 1. Year filter
        let yearData = STATE.data.filter(d => d.year === STATE.year);

        // 2. Region filter
        if (STATE.region && STATE.region !== "Global") {
            yearData = yearData.filter(d => {
                const expRegion = RegionConfig.getRegion(d.exporter);
                const impRegion = RegionConfig.getRegion(d.importer);
                return expRegion === STATE.region && impRegion === STATE.region;
            });
        }

        // 3. Remove invalid records
        let validData = yearData.filter(d => {
            if (d.exporter === "_X" || d.importer === "_X") return false;
            if (d.value <= 0) return false;
            return true;
        });

        // 4. 【極大原則】双方向の相殺 (Net Flow 計算) を「先」に行う
        // フィルターを先に行うと逆方向のフローが消去され、相殺が成立しないため
        let netFlows = this.consolidateNetFlows(validData);

        // 5. Country selector filters (正しいNet Flowに対してフィルターを適用)
        if (STATE.selectedExporters.size > 0) {
            netFlows = netFlows.filter(d => STATE.selectedExporters.has(d.exporter));
        }
        if (STATE.selectedImporters.size > 0) {
            netFlows = netFlows.filter(d => STATE.selectedImporters.has(d.importer));
        }

        // 6. Semantic Zoom Thresholding (フォーカス深度に応じた動的足切り)
        let dynamicThreshold;

        if (STATE.thresholdMode !== 'auto') {
            // 手動モード: ユーザーが選択した閾値をそのまま使用
            dynamicThreshold = STATE.thresholdMode;
        } else {
            // 自動モード: 選択状態に応じて閾値を動的に決定
            const totalSelected    = STATE.selectedExporters.size + STATE.selectedImporters.size;
            const isCountryFocused = totalSelected > 0 && totalSelected <= 5;   // 個別国: 1〜5ヶ国
            const isGroupFocused   = totalSelected > 5;                         // グループ選択: 6ヶ国以上
            const isRegionFocused  = STATE.region && STATE.region !== "Global";

            dynamicThreshold = 500000; // 深度1: Global (50万ドル)

            if (isCountryFocused) {
                dynamicThreshold = 10000;  // 深度3: 個別国フォーカス (1万ドルまで解禁し毛細血管を表示)
            } else if (isGroupFocused || isRegionFocused) {
                dynamicThreshold = 100000; // 深度2: グループ/大陸フォーカス (10万ドルまで解禁)
            }
        }

        // 閾値適用前の二国間合計を保存（凡例のカバレッジ表示用）
        STATE.totalBilateral = d3.sum(netFlows, d => d.netValue);
        STATE.totalBilateralCount = netFlows.length;

        const thresholded = netFlows.filter(d => d.netValue >= dynamicThreshold);

        // 7. Flow category filter (north-south, south-north, etc.)
        const finalFlows = thresholded.filter(d => STATE.flowFilters.has(d.flowCategory));

        // 8. 最終的に表示されるネットワークからノードの大きさを計算
        STATE.nodeStats = this.computeStatsFromNetFlows(finalFlows);
        STATE.filteredData = finalFlows;

        return finalFlows;
    },

    // 【新規追加】表示されるNetフローのみに基づき、円の大きさを正確に算出する
    computeStatsFromNetFlows(netFlows) {
        const stats = {};
        netFlows.forEach(d => {
            if (!stats[d.exporter]) stats[d.exporter] = { grossVolume: 0, netBalance: 0 };
            if (!stats[d.importer]) stats[d.importer] = { grossVolume: 0, netBalance: 0 };
            
            stats[d.exporter].grossVolume += d.netValue;
            stats[d.exporter].netBalance  += d.netValue;
            stats[d.importer].grossVolume += d.netValue;
            stats[d.importer].netBalance  -= d.netValue;
        });
        return stats;
    },


    consolidateNetFlows(data) {
        const pairMap = new Map();
        data.forEach(d => {
            const val = getMetricValue(d);
            const isAB = d.exporter <= d.importer;
            const a = isAB ? d.exporter : d.importer;
            const b = isAB ? d.importer : d.exporter;
            const key = `${a}|${b}`;
            
            if (!pairMap.has(key)) pairMap.set(key, { a, b, aToB: 0, bToA: 0 });
            const pair = pairMap.get(key);
            
            if (d.exporter === a) pair.aToB += val;
            else pair.bToA += val;
        });

        const netFlows = [];
        pairMap.forEach(({ a, b, aToB, bToA }) => {
            const net = aToB - bToA;
            if (net === 0) return;
            const exporter = net > 0 ? a : b;
            const importer = net > 0 ? b : a;
            const netValue = Math.abs(net);
            const expDev = CONFIG.development[exporter] || 'south';
            const impDev = CONFIG.development[importer] || 'south';
            const flowCategory =
                expDev === 'north' && impDev === 'south' ? 'north-south' :
                expDev === 'south' && impDev === 'north' ? 'south-north' :
                expDev === 'south' && impDev === 'south' ? 'south-south' :
                'north-north';
            netFlows.push({ exporter, importer, netValue, flowCategory });
        });
        return netFlows;
    },

    getExporters() {
        let relevantData = STATE.data.filter(d => d.year === STATE.year);

        if (STATE.region && STATE.region !== "Global") {
            relevantData = relevantData.filter(d => RegionConfig.getRegion(d.exporter) === STATE.region);
        }

        return [...new Set(relevantData.map(d => d.exporter))].sort();
    },

    getImporters() {
        let relevantData = STATE.data.filter(d => d.year === STATE.year);

        if (STATE.region && STATE.region !== "Global") {
            relevantData = relevantData.filter(d => RegionConfig.getRegion(d.importer) === STATE.region);
        }

        return [...new Set(relevantData.map(d => d.importer))].sort();
    },

    getTopExporters(count = 5) {
        let relevantData = STATE.data.filter(d => d.year === STATE.year);

        if (STATE.region && STATE.region !== "Global") {
            relevantData = relevantData.filter(d =>
                RegionConfig.getRegion(d.exporter) === STATE.region &&
                RegionConfig.getRegion(d.importer) === STATE.region
            );
        }

        const rollup = d3.rollup(relevantData, v => d3.sum(v, d => d.value), d => d.exporter);
        return Array.from(rollup).sort((a, b) => b[1] - a[1]).slice(0, count).map(d => d[0]);
    }
};