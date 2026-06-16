const ARCTIC_PERIOD_RANGE = ["1984_1988", "2019_2023"];
const ARCTIC_CLASS_COLORS = [
  "#2166ac",
  "#4393c3",
  "#92c5de",
  "#d1e5f0",
  "#f7f7f7",
  "#fddbc7",
  "#f4a582",
  "#d6604d",
  "#b2182b",
];

const dom = {
  reachCount: document.querySelector("#reach-count"),
  reachTitle: document.querySelector("#reach-title"),
  reachSubtitle: document.querySelector("#reach-subtitle"),
  metricSSC: document.querySelector("#metric-ssc"),
  metricBasin: document.querySelector("#metric-basin"),
  metricRegion: document.querySelector("#metric-region"),
  metricWidth: document.querySelector("#metric-width"),
  detailList: document.querySelector("#detail-list"),
  seriesCount: document.querySelector("#series-count"),
  search: document.querySelector("#reach-search"),
  classFilter: document.querySelector("#class-filter"),
  resetView: document.querySelector("#reset-view"),
  legend: document.querySelector("#legend"),
};

const state = {
  map: null,
  layer: null,
  outlineLayer: null,
  landLayer: null,
  chart: null,
  points: null,
  land: null,
  summary: null,
  timeseries: {},
  pointIndex: new Map(),
  selectedId: null,
  widthBreaks: [],
};

function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(Number(value));
}

function formatInteger(value) {
  return formatNumber(value, 0);
}

function formatSSC(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${formatNumber(value, 2)} mg/L`;
}

function buildArcticClassBounds(quantiles) {
  const keys = ["0.0", "0.125", "0.25", "0.375", "0.5", "0.625", "0.75", "0.875", "1.0"];
  return keys.slice(0, -1).map((key, index) => [Number(quantiles[key]), Number(quantiles[keys[index + 1]])]);
}

function createChart() {
  const ctx = document.querySelector("#timeseries-chart");
  state.chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "SSC",
          data: [],
          borderColor: "#111111",
          backgroundColor: "rgba(17, 17, 17, 0.12)",
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.18,
          spanGaps: false,
        },
      ],
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return `SSC: ${formatSSC(context.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 8 },
          grid: { color: "rgba(20, 44, 42, 0.08)" },
        },
        y: {
          title: { display: true, text: "mg/L" },
          grid: { color: "rgba(20, 44, 42, 0.08)" },
        },
      },
    },
  });
}

function initMap() {
  const crs = new L.Proj.CRS(
    "ESRI:102017",
    "+proj=laea +lat_0=90 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs",
    {
      resolutions: [64000, 32000, 16000, 8000, 4000, 2000, 1000, 500, 250],
      origin: [-9500000, 9500000],
    }
  );

  state.map = L.map("map", {
    preferCanvas: true,
    worldCopyJump: false,
    zoomSnap: 0.25,
    zoomControl: true,
    crs,
    attributionControl: false,
  }).setView([82, 0], 1);
}

function buildLegend() {
  const bounds = buildArcticClassBounds(state.summary.quantiles);
  dom.legend.innerHTML = bounds
    .map(
      (bound, index) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${ARCTIC_CLASS_COLORS[index]}"></span>
          <div>
            <div>${formatNumber(bound[0], 0)}-${formatNumber(bound[1], 0)}</div>
          </div>
        </div>
      `
    )
    .join("");
}

function buildWidthBreaks(features, classes = 5) {
  const vals = features
    .map((feature) => Number(feature.properties.width_mean))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!vals.length) return [];

  const breaks = [];
  for (let i = 0; i <= classes; i += 1) {
    const q = i / classes;
    const idx = Math.min(vals.length - 1, Math.max(0, Math.round((vals.length - 1) * q)));
    breaks.push(vals[idx]);
  }
  return breaks;
}

function getWidthClass(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || state.widthBreaks.length < 2) return 0;

  for (let i = 0; i < state.widthBreaks.length - 1; i += 1) {
    if (numeric <= state.widthBreaks[i + 1]) return i;
  }
  return state.widthBreaks.length - 2;
}

function getLineWeight(value, selected = false) {
  const weights = selected ? [1.9, 2.4, 3.0, 3.8, 4.8] : [1.0, 1.4, 1.9, 2.5, 3.3];
  return weights[getWidthClass(value)] ?? weights[0];
}

function featureStyle(feature, selected = false) {
  const color = ARCTIC_CLASS_COLORS[Number(feature.properties.ssc_class) - 1] || ARCTIC_CLASS_COLORS[0];
  return {
    color,
    weight: getLineWeight(feature.properties.width_mean, selected),
    opacity: selected ? 1 : 0.9,
  };
}

function outlineStyle(feature, selected = false) {
  return {
    color: "rgba(0, 0, 0, 0.82)",
    weight: getLineWeight(feature.properties.width_mean, selected) + 0.7,
    opacity: 0.9,
  };
}

function popupHtml(props) {
  return `
    <div class="map-popup">
      <h4>Reach ${props.ID}</h4>
      <p>${props.basin_name} | ${props.basin_cont === "NA" ? "North America" : "Eurasia"}</p>
      <p>Mean SSC: ${formatSSC(props.ssc_mean)}</p>
    </div>
  `;
}

function renderLayer() {
  if (state.outlineLayer) state.outlineLayer.remove();
  if (state.layer) state.layer.remove();
  const features = state.points.features.filter((feature) =>
    dom.classFilter.value === "all" ? true : String(feature.properties.ssc_class) === dom.classFilter.value
  );

  state.outlineLayer = L.geoJSON(
    { type: "FeatureCollection", features },
    {
      renderer: L.canvas(),
      interactive: false,
      style(feature) {
        return outlineStyle(feature, Number(feature.properties.ID) === state.selectedId);
      },
    }
  ).addTo(state.map);

  state.layer = L.geoJSON(
    { type: "FeatureCollection", features },
    {
      renderer: L.canvas(),
      style(feature) {
        return featureStyle(feature, Number(feature.properties.ID) === state.selectedId);
      },
      onEachFeature(feature, layer) {
        layer.bindPopup(popupHtml(feature.properties));
        if (layer.bringToFront) layer.bringToFront();
        layer.on("click", () => selectReach(feature.properties.ID, true));
      },
    }
  ).addTo(state.map);
}

function renderLandLayer() {
  if (!state.land) return;
  if (state.landLayer) state.landLayer.remove();

  state.landLayer = L.geoJSON(state.land, {
    interactive: false,
    style: {
      fillColor: "#f8f8f4",
      fillOpacity: 0.92,
      color: "#cfd9dc",
      weight: 0.8,
      opacity: 0.9,
    },
  }).addTo(state.map);
}

function refreshSelectedStyle() {
  if (state.outlineLayer) {
    state.outlineLayer.eachLayer((layer) => {
      layer.setStyle(outlineStyle(layer.feature, Number(layer.feature.properties.ID) === state.selectedId));
    });
  }
  if (!state.layer) return;
  state.layer.eachLayer((layer) => {
    layer.setStyle(featureStyle(layer.feature, Number(layer.feature.properties.ID) === state.selectedId));
  });
}

function updateDetails(props) {
  const rows = [
    ["ID", props.ID],
    ["Basin name", props.basin_name],
    ["Region", props.basin_cont === "NA" ? "North America" : "Eurasia"],
    ["Mean width", `${formatInteger(props.width_mean)} m`],
    ["Mean SSC", formatSSC(props.ssc_mean)],
  ];

  dom.detailList.innerHTML = rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value ?? "-"}</dd></div>`)
    .join("");
}

function updateChart(series) {
  const values = series.values.map((value) => (value == null ? null : Number(value)));
  const valid = values.filter((value) => value != null && Number.isFinite(value));
  const maxValue = valid.length ? Math.max(...valid) : 0;

  state.chart.data.labels = series.periods;
  state.chart.data.datasets[0].data = values;
  state.chart.options.scales.y.min = 0;
  state.chart.options.scales.y.max = maxValue > 0 ? maxValue * 1.12 : 1;
  state.chart.update();
  dom.seriesCount.textContent = `${valid.length} valid periods`;
}

function selectReach(id, flyTo = false) {
  const feature = state.pointIndex.get(Number(id));
  if (!feature) return;
  const series = state.timeseries[String(id)];
  if (!series) return;

  state.selectedId = Number(id);
  const props = feature.properties;

  dom.reachTitle.textContent = `Reach ${props.ID}`;
  dom.reachSubtitle.textContent = `${props.basin_name} | ${ARCTIC_PERIOD_RANGE[0]} to ${ARCTIC_PERIOD_RANGE[1]} SSC record`;
  dom.metricSSC.textContent = formatSSC(props.ssc_mean);
  dom.metricBasin.textContent = props.basin_name;
  dom.metricRegion.textContent = props.basin_cont === "NA" ? "North America" : "Eurasia";
  dom.metricWidth.textContent = `${formatInteger(props.width_mean)} m`;

  updateDetails(props);
  updateChart(series);
  refreshSelectedStyle();

  if (flyTo) {
    const bounds = L.geoJSON(feature).getBounds();
    if (bounds.isValid()) {
      state.map.fitBounds(bounds.pad(0.8), { maxZoom: 6 });
    }
  }
}

function handleSearch() {
  const value = Number(dom.search.value);
  if (!Number.isFinite(value)) return;
  selectReach(value, true);
}

async function loadData() {
  const [pointsRes, tsRes, summaryRes, landRes] = await Promise.all([
    fetch("./data/arctic_ssc/arctic_reaches_ssc.geojson"),
    fetch("./data/arctic_ssc/arctic_ssc_timeseries.json"),
    fetch("./data/arctic_ssc/arctic_summary.json"),
    fetch("./data/arctic_land_50m.geojson"),
  ]);

  state.points = await pointsRes.json();
  state.timeseries = await tsRes.json();
  state.summary = await summaryRes.json();
  state.land = await landRes.json();
  state.pointIndex = new Map(state.points.features.map((feature) => [Number(feature.properties.ID), feature]));
  state.widthBreaks = buildWidthBreaks(state.points.features, 5);

  dom.reachCount.textContent = `${state.summary.reach_count.toLocaleString("en-US")} reaches`;
  buildLegend();
  renderLandLayer();
  renderLayer();
  applyDefaultView();

  if (state.points.features.length) {
    selectReach(state.points.features[0].properties.ID, false);
  }
}

function applyDefaultView() {
  const focusBounds = L.latLngBounds(
    [82, -182],
    [90, 170]
  );

  state.map.fitBounds(focusBounds, {
    paddingTopLeft: [26, 18],
    paddingBottomRight: [26, 18],
    maxZoom: 2.2,
  });
}

function wireEvents() {
  dom.search.addEventListener("change", handleSearch);
  dom.search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleSearch();
  });

  dom.classFilter.addEventListener("change", () => {
    renderLayer();
    refreshSelectedStyle();
  });

  dom.resetView.addEventListener("click", () => {
    applyDefaultView();
  });
}

async function boot() {
  initMap();
  createChart();
  wireEvents();
  await loadData();
}

boot().catch((error) => {
  console.error(error);
  dom.reachTitle.textContent = "Data failed to load";
  dom.reachSubtitle.textContent = "Please serve the folder through a local or static web server.";
});
