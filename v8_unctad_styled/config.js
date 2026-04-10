const CONFIG = {
    // Files
    csvFile: 'data/BACI.csv',
    geoJsonUrl: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json',

    thresholds: {
        value:      { large: 5000000, medium: 500000 },
        weight:     { large: 5000000, medium: 500000 },
        unit_price: { large: 5.0,     medium: 1.0    }
    },

    colors: {
        value:      { label: "Export Value ($)",   discrete: { large: "#0ea5e9", medium: "#6366f1", small: "#334155" } },
        weight:     { label: "Weight (kg)",         discrete: { large: "#facc15", medium: "#22c55e", small: "#0f766e" } },
        unit_price: { label: "Export Cost ($/kg)", discrete: { large: "#fbbf24", medium: "#f8fafc", small: "#ef4444" } },
    },

    // Flow category base colors (North = Developed, South = Developing/LDC)
    flowColors: {
        'north-south': '#06b6d4',  // Cyan
        'south-north': '#f43f5e',  // Magenta
        'south-south': '#f59e0b',  // Amber
        'north-north': '#64748b',  // Slate
    },

    // Development status: 'north' = Developed economies (1500)
    // All unlisted countries default to 'south' (1400 / 1610 Developing/LDC)
    development: {
        'USA': 'north', 'CAN': 'north', 'GRL': 'north',
        'GBR': 'north', 'FRA': 'north', 'DEU': 'north', 'ITA': 'north', 'ESP': 'north',
        'NLD': 'north', 'BEL': 'north', 'AUT': 'north', 'SWE': 'north', 'NOR': 'north',
        'DNK': 'north', 'FIN': 'north', 'CHE': 'north', 'PRT': 'north', 'GRC': 'north',
        'IRL': 'north', 'POL': 'north', 'CZE': 'north', 'HUN': 'north', 'ROU': 'north',
        'BGR': 'north', 'SVK': 'north', 'SVN': 'north', 'HRV': 'north', 'EST': 'north',
        'LVA': 'north', 'LTU': 'north', 'LUX': 'north', 'MLT': 'north', 'CYP': 'north',
        'ISL': 'north', 'AND': 'north', 'SMR': 'north', 'MCO': 'north', 'LIE': 'north',
        'MNE': 'north', 'SRB': 'north', 'BIH': 'north', 'MKD': 'north', 'ALB': 'north',
        'RUS': 'north', 'UKR': 'north', 'BLR': 'north', 'MDA': 'north',
        'ISR': 'north',
        'AUS': 'north', 'NZL': 'north', 'JPN': 'north', 'KOR': 'north'
    }
};

// Returns the active metric value from a raw data row
function getMetricValue(d) {
    const m = STATE.metric || 'value';
    return m === 'weight' ? d.weight : m === 'unit_price' ? d.unitPrice : d.value;
}

// Metric display formatting (used by tooltips and legends)
const METRIC_FORMAT = {
    value:      { grossLabel: 'Gross Volume:', netLabel: 'Net Balance:',
                  fmt: (v) => { const a = Math.abs(v); const s = v < 0 ? '-' : ''; if (a >= 1e9) return s + '$' + d3.format('.2f')(a / 1e9) + 'B'; if (a >= 1e6) return s + '$' + d3.format('.2f')(a / 1e6) + 'M'; if (a >= 1e3) return s + '$' + d3.format('.2f')(a / 1e3) + 'K'; return s + '$' + d3.format(',.0f')(a); } },
    weight:     { grossLabel: 'Total Mass:',   netLabel: 'Net Mass:',
                  fmt: (v) => d3.format(',.0f')(v / 1000) + ' Tons' },
    unit_price: { grossLabel: 'Avg Price:',    netLabel: 'Net Price:',
                  fmt: (v) => '$' + d3.format('.2f')(v) + '/kg' },
};

const STATE = {
    data: [],
    geoData: null,
    filteredData: [],       // consolidated net flows after all filters
    nodeStats: {},          // { ISO: { grossVolume, netBalance } }
    totalBilateral: 0,      // sum of all bilateral net flows (pre-threshold)
    totalBilateralCount: 0, // count of all bilateral net flows (pre-threshold)

    year: 2024,
    metric: "value",
    mapMode: "flat",

    selectedExporters: new Set(),
    selectedImporters: new Set(),

    // Flow category visibility filters
    flowFilters: new Set(['north-south', 'south-north', 'south-south', 'north-north']),

    countryCoords: {},
    countryNames: {},

    // Label visibility toggles
    showExporterLabels: true,
    showImporterLabels: true,

    // Threshold mode: 'auto' | 500000 | 100000 | 10000
    thresholdMode: 'auto',
};
