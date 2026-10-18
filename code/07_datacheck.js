/**
 * 01_shared/07_datacheck.js — read-only inspector for the shared constants
 * that feed 06_damage_calc.js: unit costs (with sources), DDF curves,
 * province ratios, crops & fish, exposure Assets ("Verify every Asset")
 * and engine tests. Run standalone in the Code Editor; nothing requires it.
 * Everything renders client-side except the Asset probes and Engine Test.
 * render(section) dispatches to one renderXxx() that fills the content panel.
 */

var UC  = require('users/kurihara-yt/dibi:01_shared/02_unit_costs');
var DDF = require('users/kurihara-yt/dibi:01_shared/03_damage_curves');
var C   = require('users/kurihara-yt/dibi:01_shared/01_constants');


// ====================================================================
// Format helpers
// ====================================================================
function idr(v) {
  if (v === null || v === undefined) return '-';
  return 'Rp ' + Math.round(v).toLocaleString();
}
function pct(v) { return (v * 100).toFixed(0) + ' %'; }

// 'INFRA.road_tol_per_km' -> UC.INFRA.road_tol_per_km
function ucValue(key) {
  var p = key.split('.');
  return UC[p[0]][p[1]];
}


// ====================================================================
// Palette — same light-mode data-viz palette as 01_dashboard.js.
// Categorical slots in FIXED order; sequential = one hue (blue).
// ====================================================================
var COL = {
  ink:        '#0b0b0b',
  inkSoft:    '#52514e',
  muted:      '#898781',
  grid:       '#e1e0d9',
  surface:    '#fcfcfb',
  page:       '#f9f9f7',
  headerBg:   '#1a3d6d',
  headerInk:  '#ffffff',
  headerSub:  '#b9c6dd',
  critical:   '#d03b3b',
  good:       '#0a6f00',
  blue:       '#2a78d6',
};
var CAT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100',
           '#e87ba4', '#008300', '#4a3aa7', '#e34948'];


// ====================================================================
// Widget helpers
// ====================================================================
// Zebra striping for hand-built tables: head() / tableHead() reset the
// counter, every data row takes zbg(). Rendering is sequential, so one
// module-level counter is enough.
var _z = 0;
function zbg() { return (_z++ % 2 === 0) ? COL.surface : '#f3f2ef'; }

// One zebra row. cells: [text, style] (fontSize defaults to 11px) or a
// function(bg) returning a widget. ui.Label defaults to a WHITE
// background, so every cell must carry the row's own color.
function zrow(cells, margin) {
  var bg = zbg();
  var widgets = cells.map(function(c) {
    if (typeof c === 'function') return c(bg);
    var s = c[1] || {};
    if (!s.fontSize) s.fontSize = '11px';
    s.backgroundColor = bg;
    return ui.Label(c[0], s);
  });
  return ui.Panel(widgets, ui.Panel.Layout.flow('horizontal'),
                  {margin: margin || '0', padding: '1px 4px',
                   backgroundColor: bg});
}

// Table header row. cols: [text, width, margin] (width / margin optional).
function tableHead(cols, margin) {
  _z = 0;
  var widgets = cols.map(function(c) {
    var s = {fontSize: '11px', fontWeight: 'bold', color: COL.inkSoft,
             backgroundColor: COL.page};
    if (c[1]) s.width = c[1];
    if (c[2]) s.margin = c[2];
    return ui.Label(c[0], s);
  });
  return ui.Panel(widgets, ui.Panel.Layout.flow('horizontal'),
                  {margin: margin || '0', padding: '2px 4px',
                   backgroundColor: COL.page, border: '1px solid ' + COL.grid});
}

// Two-column label / value row.
function row(label, value, opts) {
  opts = opts || {};
  return zrow([
    [label, {color: COL.inkSoft, margin: '1px 6px 1px 0', width: '240px'}],
    [value, {color: opts.color || COL.ink, margin: '1px 0',
             fontWeight: opts.bold ? 'bold' : 'normal'}],
  ]);
}

function head(t) {
  _z = 0;
  return ui.Label(t, {
    fontWeight: 'bold', fontSize: '13px', color: COL.headerBg,
    margin: '16px 0 4px 0',
    backgroundColor: '#e9eef7', padding: '6px 10px',
  });
}
function note(t) {
  return ui.Label(t, {
    fontSize: '10px', color: COL.muted, fontStyle: 'italic',
    margin: '0 0 6px 0',
  });
}

// KPI stat tile: caption on top, big value, small sub-line.
function makeKpiTile(caption, value, sub, valueColor, width) {
  return ui.Panel([
    ui.Label(caption, {fontSize: '10px', color: COL.muted,
                       margin: '0 0 2px 0', backgroundColor: COL.surface}),
    ui.Label(value, {fontSize: '20px', fontWeight: 'bold',
                     color: valueColor || COL.ink, margin: '0',
                     backgroundColor: COL.surface}),
    ui.Label(sub || ' ', {fontSize: '9px', color: COL.muted,
                          margin: '2px 0 0 0',
                          backgroundColor: COL.surface}),
  ], ui.Panel.Layout.flow('vertical'), {
    backgroundColor: COL.surface,
    border: '1px solid ' + COL.grid,
    padding: '8px 14px',
    margin: '0 8px 0 0',
    width: width || '175px',
  });
}

// Chart axis options shared by the charts: muted text, light gridlines.
function chartAxis(extra) {
  var a = {textStyle: {color: COL.muted, fontSize: 10},
           gridlines: {color: COL.grid}, baselineColor: COL.grid};
  for (var k in extra) a[k] = extra[k];
  return a;
}


// ====================================================================
// References — each unit-cost key mapped to its source (Cost sheet Column
// G where available; [J] entries cite the primary source the Furukawa
// Excel itself referenced; see dataset_inventory.xlsx).
// ====================================================================
var REF = {
  // C-4 Housing
  'HOUSING.rb_per_m2':   'SHST DKI Jakarta 2025 Rumah Tipe C/D/E [G base]',
  'HOUSING.avg_floor_m2':'BPS Susenas typical simple housing',
  'HOUSING.furniture_per_hh': 'BPS Susenas per-capita non-food exp. proxy',
  'HOUSING.utility_per_unit': 'PLN new connection (1300 VA)',
  'HOUSING.persons_per_house':
      'BPS SP2020 average household size — drives the EARTHQUAKE population ' +
      '(building count x this). Assumes 1 household per building.',
  // C-5 Infra buildings
  'INFRA.health_per_m2':       'SHST Gedung Tidak Sederhana [G]',
  'INFRA.puskesmas_per_m2':    'SHST Gedung Sederhana [G]',
  'INFRA.university_per_m2':   'SHST Gedung Tidak Sederhana [G]',
  'INFRA.edu_per_m2':          'SHST Gedung Sederhana [G] (school/madrasah)',
  'INFRA.worship_per_m2':      'SHST Gedung Tidak Sederhana [G] (masjid raya)',
  'INFRA.gov_office_per_m2':   'SHST Gedung Sederhana [G] (Kantor)',
  'INFRA.market_per_m2':       'DKI Jakarta HSB 4-story building rate [G]',
  // C-5 Infra roads (per m² × width × 1000 = per km)
  'INFRA.road_nasional_per_km':  'Medan HSPK 2025 × 7 m width [G]',
  'INFRA.road_kabupaten_per_km': 'Medan HSPK 2025 × 5 m width [G]',
  'INFRA.road_desa_per_km':     'Medan HSPK 2025 × 3 m width [G]',
  'INFRA.road_tol_per_km':      'AHSP Bina Marga proxy [J] (~2.5× the 4 B/km reference nasional)',
  'INFRA.road_embankment_per_m3':'Medan HSPK 2025 [G]',
  // C-5 Infra bridges / power / water
  'INFRA.bridge_per_m':      'AHSP Bina Marga composite [J]',
  'INFRA.bridge_avg_m':      'nasional bridge avg length',
  'INFRA.power_line_per_km': 'Jitupasna past budget requests, national avg [E] — no province ratio',
  'INFRA.substation_each':   'PLN RUPTL (Gardu Induk) [J]',
  'INFRA.plant_per_mw':      'PLN RUPTL mid-range MW cost [J]',
  'INFRA.geothermal_per_mw': 'PLN RUPTL (PLTP) [J]',
  'INFRA.water_treatment_per_lps': 'AHSP Cipta Karya + PDAM Statistik [J]',
  'INFRA.water_supply_per_m': 'PU Ditjen Cipta Karya [E]',
  'INFRA.telecom_per_unit':  'Telekom BTS avg [E]',
  'INFRA.airport_each':      'Standar Biaya Bandara (Kemenhub) [J]',
  'INFRA.seaport_each':      'order-of-magnitude estimate [J] (no primary source)',
  'INFRA.embankment_per_m':  'AHSP Bidang SDA — concrete 3 m [J]',
  'INFRA.mangrove_per_ha':   'KLHK Rehabilitasi Hutan dan Lahan [J]',
  // C-2 Agri
  'AGRI.rice_gkp_per_kg':    'BPS Statistik Tanaman Pangan (File01)',
  'AGRI.rice_milled_per_kg': '↳ same (BPS Panel Harga Pangan)',
  'AGRI.rice_gkg_per_kg':    '↳ same',
  'AGRI.rice_yield_kg_per_ha':'BPS — Java typical yield',
  'AGRI.perennial_replant_per_ha': 'BPDPKS PSR std (60 jt/ha, 2024-09 rev.; KEP-167/2020 was 30 jt)',
  'AGRI.coffee_per_kg':      'BPS Statistik Hortikultura',
  'AGRI.cocoa_per_kg':       '↳ same',
  'AGRI.egg_per_kg':         'BPS Statistik Peternakan (File02)',
  'AGRI.milk_per_l':         '↳ same',
  'AGRI.cattle_per_head':    '↳ same',
  'AGRI.goat_per_head':      '↳ same',
  'AGRI.poultry_feed_per_kg':'BPS / Asosiasi Peternak',
  'AGRI.ruminant_feed_per_kg':'↳ same',
  'AGRI.beef_per_kg':        'BPS Statistik Peternakan',
  'AGRI.chicken_meat_per_kg':'↳ same',
  'AGRI.beehive_each':       'LKPP e-Katalog',
  'AGRI.timber_per_m3':      'KLHK Harga Patokan Kayu (SIPNBP)',
  'AGRI.timber_per_ha_proxy':'derived (50 m³/ha × price)',
  'AGRI.catfish_tilapia_per_kg':'KKP Statistik Perikanan (File04)',
  'AGRI.fingerling_each':    '↳ same',
  'AGRI.vessel_per_gt':      'KKP / LKPP — FRP boat std',
  // C-3 Commerce
  'COMMERCE.factory_per_m2':   'RLB Rider\'s Digest 2025 [QS] Industrial Warehouse, low (Jakarta Q4-2024)',
  'COMMERCE.shop_per_m2':      'RLB 2025 [QS] Retail Mall, low (no ruko category for Jakarta)',
  'COMMERCE.warehouse_per_m2': 'RLB 2025 [QS] Industrial Warehouse, low',
  'COMMERCE.hotel_per_m2':     'RLB 2025 [QS] Hotel 3-star, low (excl. FF&E)',
  'COMMERCE.office_per_m2':    'RLB 2025 [QS] Office Grade A, low',
  'COMMERCE.shop_avg_m2':      'typical Ruko',
  'COMMERCE.warehouse_avg_m2': 'typical small warehouse',
  'COMMERCE.factory_avg_m2':   'small/medium factory',
  'COMMERCE.hotel_avg_m2':     '3-star hotel proxy',
  'COMMERCE.office_avg_m2':    'small office proxy',
  // Indirect L-1..L-4
  'INDIRECT.business_per_worker_day_jakarta':
      'BPS PDRB (GRDP)/worker/365 — Jakarta retail/trade',
  'INDIRECT.business_per_worker_day_national':
      '↳ national avg',
  'INDIRECT.cleaning_materials_jakarta':
      'Market price (bucket, mop, detergent, bags)',
  'INDIRECT.cleaning_materials_national': '↳ national avg',
  'INDIRECT.substitute_meals_jakarta':
      'Susenas prepared-food expenditure minus home-cook',
  'INDIRECT.substitute_meals_national': '↳ national avg',
  'INDIRECT.cleaning_labor_jakarta':
      'UMK / 22 working days (Jakarta 2024 UMK)',
  'INDIRECT.cleaning_labor_national': '↳ national avg UMK',
  'INDIRECT.default_business_days': 'Convention (typical urban flood)',
  'INDIRECT.default_meals_days':    '↳ same',
  'INDIRECT.default_labor_days':    '↳ same',
};


// ====================================================================
// Full-screen layout
// ====================================================================
ui.root.clear();
ui.root.setLayout(ui.Panel.Layout.flow('vertical'));

// ---------- Header bar ----------
var SECTIONS = ['Unit Costs', 'DDF Curves',
                'Province Ratio', 'Crops & Fish', 'Exposure', 'Sanity Test',
                'Engine Test'];
var sectionSelect = ui.Select({items: SECTIONS, value: SECTIONS[0]});
sectionSelect.style().set('width', '240px');

// Every widget inside the dark header needs backgroundColor set
// explicitly — nested panels and labels default to white boxes.
ui.root.add(ui.Panel([
  ui.Panel([
    ui.Label('Data Check — Shared Constants Inspector', {
      fontSize: '17px', fontWeight: 'bold', color: COL.headerInk,
      margin: '0', backgroundColor: COL.headerBg,
    }),
    ui.Label('Client-side viewer · sanity-check the inputs that feed ' +
             '06_damage_calc.js', {
      fontSize: '10px', color: COL.headerSub, margin: '2px 0 0 0',
      backgroundColor: COL.headerBg,
    }),
  ], ui.Panel.Layout.flow('vertical'),
     {margin: '0 24px 0 0', backgroundColor: COL.headerBg}),
  ui.Label('Section:', {
    fontSize: '11px', fontWeight: 'bold', color: COL.headerSub,
    margin: '10px 8px 0 0', backgroundColor: COL.headerBg,
  }),
  sectionSelect,
], ui.Panel.Layout.flow('horizontal'), {
  backgroundColor: COL.headerBg,
  padding: '10px 14px',
  stretch: 'horizontal',
}));

// ---------- KPI row ----------
ui.root.add(ui.Panel([
  makeKpiTile('UNIT-COST ENTRIES', String(Object.keys(REF).length),
              'with source references'),
  makeKpiTile('DDF CURVES', String(Object.keys(DDF.CURVES).length),
              'JRC Huizinga 2017 (Asia)', COL.blue),
  makeKpiTile('PROVINCES', String(Object.keys(UC.PROVINCE_RATIO).length),
              'BPS IKK 2025 cost ratios'),
  makeKpiTile('CROPS & FISH',
              String(Object.keys(UC.CROPS_PER_M2).length +
                     Object.keys(UC.FISH_PER_M2).length),
              'production values per m²'),
  makeKpiTile('BASELINE', 'DKI Jakarta', '2025 unit costs (SHST)',
              COL.critical, '210px'),
], ui.Panel.Layout.flow('horizontal'),
   {backgroundColor: COL.page, padding: '10px 14px 6px 14px',
    stretch: 'horizontal'}));

// ---------- Content card ----------
var content = ui.Panel({
  style: {stretch: 'both', padding: '4px 14px 14px 14px',
          backgroundColor: COL.surface, border: '1px solid ' + COL.grid},
  layout: ui.Panel.Layout.flow('vertical'),
});
ui.root.add(ui.Panel([content], ui.Panel.Layout.flow('vertical'),
  {stretch: 'both', padding: '8px 14px 14px 14px', backgroundColor: COL.page}));


// ====================================================================
// Dispatcher
// ====================================================================
var RENDER = {
  'Unit Costs':     renderUnitCosts,
  'DDF Curves':     renderDDF,
  'Province Ratio': renderProvinceRatio,
  'Crops & Fish':   renderCropsFish,
  'Exposure':       renderExposure,
  'Sanity Test':    renderSanity,
  'Engine Test':    renderEngineTest,
};
function render(name) {
  content.clear();
  if (RENDER[name]) RENDER[name]();
}
sectionSelect.onChange(render);


// ====================================================================
// 1) UNIT COSTS — value + source column
// ====================================================================
function renderUnitCosts() {
  // One table: header + rows of [label, 'GROUP.key', unit, bold].
  // unit omitted -> idr(value); otherwise value + unit ('' = plain).
  function unitTable(title, rows, noteText) {
    content.add(head(title));
    if (noteText) content.add(note(noteText));
    content.add(tableHead([['Item', '240px', '0 6px 0 0'],
                           ['Value', '170px', '0 6px 0 0'],
                           ['Reference / Source']], '4px 0 2px 0'));
    rows.forEach(function(r) {
      var v = ucValue(r[1]);
      content.add(zrow([
        [r[0], {color: COL.inkSoft, margin: '1px 6px 1px 0', width: '240px'}],
        [r[2] == null ? idr(v) : v + r[2],
         {color: COL.ink, margin: '1px 6px 1px 0', width: '170px',
          fontWeight: r[3] ? 'bold' : 'normal'}],
        [REF[r[1]] || '—', {fontSize: '10px', color: COL.muted,
                            margin: '1px 0', fontStyle: 'italic'}],
      ]));
    });
  }

  content.add(note('Indonesian unit costs at 100 % damage (DKI Jakarta 2025 baseline). ' +
    'Multiply by DDF(depth) for damage ratio and PROVINCE_RATIO for locality.'));

  unitTable('C-4 Housing (Permukiman) — 100 % base', [
    ['house / m² (Rumah C/D/E)', 'HOUSING.rb_per_m2', null, true],
    ['avg floor area',           'HOUSING.avg_floor_m2', ' m²'],
    ['furniture / HH',           'HOUSING.furniture_per_hh'],
    ['utility / unit',           'HOUSING.utility_per_unit'],
    ['occupants / house',        'HOUSING.persons_per_house', ' people'],
  ]);

  unitTable('C-5 Sosial (Buildings, 100 % base)', [
    ['hospital / m² (Gedung TS)',           'INFRA.health_per_m2', null, true],
    ['puskesmas / m² (Gedung Sederhana)',   'INFRA.puskesmas_per_m2'],
    ['university / m² (Gedung TS)',         'INFRA.university_per_m2'],
    ['school / madrasah / m²',              'INFRA.edu_per_m2'],
    ['worship / m² (masjid raya)',          'INFRA.worship_per_m2'],
    ['government office / m²',              'INFRA.gov_office_per_m2'],
    ['market / m² (4-story HSB)',           'INFRA.market_per_m2'],
  ]);

  unitTable('C-5 Infrastruktur — Roads (per grade)', [
    ['road nasional / km',    'INFRA.road_nasional_per_km', null, true],
    ['road kabupaten / km',   'INFRA.road_kabupaten_per_km'],
    ['road desa / km',        'INFRA.road_desa_per_km'],
    ['road tol / km',         'INFRA.road_tol_per_km'],
    ['road embankment / m³',  'INFRA.road_embankment_per_m3'],
  ]);

  unitTable('C-5 Infrastruktur — Bridges / Power / Water / Telecom', [
    ['bridge / m',            'INFRA.bridge_per_m'],
    ['bridge avg length',     'INFRA.bridge_avg_m', ' m'],
    ['power line / km',       'INFRA.power_line_per_km'],
    ['substation each',       'INFRA.substation_each'],
    ['plant / MW',            'INFRA.plant_per_mw'],
    ['geothermal / MW (PLTP)','INFRA.geothermal_per_mw'],
    ['water treatment / Lps', 'INFRA.water_treatment_per_lps'],
    ['water supply / m',      'INFRA.water_supply_per_m'],
    ['telecom BTS / unit',    'INFRA.telecom_per_unit'],
    ['airport (each)',        'INFRA.airport_each'],
    ['seaport (each)',        'INFRA.seaport_each'],
    ['embankment (concrete)/m', 'INFRA.embankment_per_m'],
    ['mangrove / ha',         'INFRA.mangrove_per_ha'],
  ]);

  unitTable('C-2 Agricultural', [
    ['rice GKP / kg',         'AGRI.rice_gkp_per_kg'],
    ['rice milled / kg',      'AGRI.rice_milled_per_kg'],
    ['rice GKG / kg',         'AGRI.rice_gkg_per_kg'],
    ['rice yield / ha',       'AGRI.rice_yield_kg_per_ha', ' kg'],
    ['perennial replant / ha', 'AGRI.perennial_replant_per_ha', null, true],
    ['coffee / kg',           'AGRI.coffee_per_kg'],
    ['cocoa / kg',            'AGRI.cocoa_per_kg'],
    ['egg / kg',              'AGRI.egg_per_kg'],
    ['milk / L',              'AGRI.milk_per_l'],
    ['cattle / head',         'AGRI.cattle_per_head'],
    ['goat / head',           'AGRI.goat_per_head'],
    ['poultry feed / kg',     'AGRI.poultry_feed_per_kg'],
    ['ruminant feed / kg',    'AGRI.ruminant_feed_per_kg'],
    ['beef / kg',             'AGRI.beef_per_kg'],
    ['chicken meat / kg',     'AGRI.chicken_meat_per_kg'],
    ['beehive (each)',        'AGRI.beehive_each'],
    ['timber / m³',           'AGRI.timber_per_m3'],
    ['forest replant proxy / ha', 'AGRI.timber_per_ha_proxy'],
    ['catfish/tilapia / kg',  'AGRI.catfish_tilapia_per_kg'],
    ['fingerling (each)',     'AGRI.fingerling_each'],
    ['fishing vessel / GT',   'AGRI.vessel_per_gt'],
  ]);

  unitTable('C-3 Other Productive (Industry / Commerce)', [
    ['factory / m²',          'COMMERCE.factory_per_m2'],
    ['shop / m²',             'COMMERCE.shop_per_m2'],
    ['warehouse / m²',        'COMMERCE.warehouse_per_m2'],
    ['hotel / m²',            'COMMERCE.hotel_per_m2'],
    ['office / m²',           'COMMERCE.office_per_m2'],
    ['avg shop area',         'COMMERCE.shop_avg_m2', ' m²'],
    ['avg warehouse area',    'COMMERCE.warehouse_avg_m2', ' m²'],
    ['avg factory area',      'COMMERCE.factory_avg_m2', ' m²'],
    ['avg hotel area',        'COMMERCE.hotel_avg_m2', ' m²'],
    ['avg office area',       'COMMERCE.office_avg_m2', ' m²'],
  ]);

  unitTable('Indirect L-1..L-4 (Jakarta / National)', [
    ['L-1 worker / day (Jakarta)',  'INDIRECT.business_per_worker_day_jakarta'],
    ['L-1 worker / day (national)', 'INDIRECT.business_per_worker_day_national'],
    ['L-2 HH / event (Jakarta)',    'INDIRECT.cleaning_materials_jakarta'],
    ['L-2 HH / event (national)',   'INDIRECT.cleaning_materials_national'],
    ['L-3 meals / day (Jakarta)',   'INDIRECT.substitute_meals_jakarta'],
    ['L-3 meals / day (national)',  'INDIRECT.substitute_meals_national'],
    ['L-4 labor / day (Jakarta)',   'INDIRECT.cleaning_labor_jakarta'],
    ['L-4 labor / day (national)',  'INDIRECT.cleaning_labor_national'],
    ['default business days',       'INDIRECT.default_business_days', ''],
    ['default meals days',          'INDIRECT.default_meals_days', ''],
    ['default labor days',          'INDIRECT.default_labor_days', ''],
  ]);

  unitTable('RF-LULC class → cost (drives land_cover_ha damage classes)', [],
    'In-house Random-Forest LULC (BNPB/lulc_idn_2025_30m, 30 m). ' +
    'Unpriced classes (3 Sand · 5 City · 6 Water) carry no land-cover damage.');
  var LULC_LABEL = {1: 'Rice (Sawah)', 2: 'Corn (Tegalan)',
                    4: 'Forest (Hutan)', 7: 'Palm oil (Kebun)'};
  var LULC_NOTE = {1: 'rice price × yield [G]',
                   2: 'corn production value [G]',
                   4: 'KLHK critical-land rehab, 14-17 juta/ha mid-point'};
  Object.keys(UC.LULC_TO_COST).forEach(function(id) {
    var e = UC.LULC_TO_COST[id];
    content.add(zrow([
      ['class ' + id + ' — ' + (LULC_LABEL[id] || e.key),
       {color: COL.inkSoft, width: '240px', margin: '0 6px 0 0'}],
      ['[' + e.sendai + ']  ' + idr(e.cost_per_ha) + ' / ha',
       {color: COL.ink, width: '170px', margin: '0 6px 0 0'}],
      [LULC_NOTE[id] ||
       'Perkebunan — Jitupasna past requests, natl avg [E], no prov ratio',
       {fontSize: '10px', color: COL.muted, fontStyle: 'italic'}],
    ]));
  });
}


// ====================================================================
// 2) DDF — line charts (single curve or "All" overlay)
// ====================================================================
function renderDDF() {
  content.add(head('Depth-Damage Functions'));
  content.add(note('JRC Huizinga 2017 — depth (m) → damage ratio (0..1). ' +
    'Asian region, piecewise-linear between control points.'));

  var names = Object.keys(DDF.CURVES);
  var curveSel = ui.Select({items: ['(All curves)'].concat(names),
                            value: 'residential'});
  curveSel.style().set('width', '220px');
  content.add(ui.Panel([
    ui.Label('Curve:', {fontSize: '11px', fontWeight: 'bold',
                        margin: '5px 8px 0 0', color: '555'}),
    curveSel,
  ], ui.Panel.Layout.flow('horizontal'), {margin: '0 0 8px 0'}));

  var chartHolder = ui.Panel({style: {margin: '4px 0'}});
  var tableHolder = ui.Panel({style: {margin: '4px 0'}});
  content.add(chartHolder);
  content.add(tableHolder);

  // Line chart of depth -> ratio features; both charts share the axes.
  function ddfChart(feats, series, extra) {
    var axisTitle = {color: COL.muted, italic: false};
    var opts = {
      titleTextStyle: {color: COL.inkSoft, fontSize: 12, bold: true},
      hAxis: chartAxis({title: 'Depth (m)', minValue: 0,
                        titleTextStyle: axisTitle}),
      vAxis: chartAxis({title: 'Damage ratio',
                        viewWindow: {min: 0, max: 1.0},
                        ticks: [0, 0.25, 0.5, 0.75, 1.0],
                        format: 'percent',
                        titleTextStyle: axisTitle}),
      backgroundColor: COL.surface,
    };
    for (var k in extra) opts[k] = extra[k];
    return ui.Chart.feature.byFeature(ee.FeatureCollection(feats), 'depth', series)
      .setChartType('LineChart')
      .setOptions(opts);
  }

  function showCurve(curveName) {
    chartHolder.clear();
    tableHolder.clear();

    if (curveName === '(All curves)') {
      var xs = [];
      for (var d = 0; d <= 6.0001; d += 0.25) xs.push(+d.toFixed(2));
      chartHolder.add(ddfChart(xs.map(function(d) {
        var p = {depth: d};
        names.forEach(function(n) { p[n] = DDF.evaluate(n, d); });
        return ee.Feature(null, p);
      }), names, {
        title: 'All DDF curves (depth → damage ratio)',
        height: 380,
        lineWidth: 2,
        pointSize: 2,
        colors: CAT,
        legend: {position: 'right',
                 textStyle: {color: COL.inkSoft, fontSize: 11}},
      }));

      tableHolder.add(ui.Label('Damage ratios at common depths (%):',
        {fontWeight: 'bold', fontSize: '12px', color: '333',
         margin: '8px 0 4px 0'}));
      var depthGrid = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0];
      tableHolder.add(tableHead(
        [['Curve', '170px']].concat(depthGrid.map(function(d) {
          return [d + ' m', '60px'];
        })), '0'));
      names.forEach(function(n) {
        var cells = [[n, {width: '170px', color: '#333333'}]];
        depthGrid.forEach(function(d) {
          var r = DDF.evaluate(n, d);
          cells.push([pct(r), {width: '60px',
                               color: r > 0.5 ? COL.critical : '#333333',
                               fontWeight: r > 0.5 ? 'bold' : 'normal'}]);
        });
        tableHolder.add(zrow(cells));
      });
    } else {
      var c = DDF.CURVES[curveName];
      chartHolder.add(ddfChart(c.depths_m.map(function(d, i) {
        return ee.Feature(null, {depth: d, ratio: c.ratios[i]});
      }), ['ratio'], {
        title: curveName + ' DDF',
        height: 320,
        colors: [COL.blue],
        lineWidth: 3,
        pointSize: 5,
        legend: {position: 'none'},
      }));

      tableHolder.add(ui.Label(
        'Control points (defined by JRC paper):',
        {fontWeight: 'bold', fontSize: '12px', color: '333',
         margin: '8px 0 2px 0'}));
      tableHolder.add(ui.Label(
        'These are the depth / damage-ratio anchor values from ' +
        'Huizinga et al. 2017 (Asian region).',
        {fontSize: '10px', color: '666', fontStyle: 'italic',
         margin: '0 0 4px 0'}));
      tableHolder.add(tableHead([['Depth (m)', '110px'],
                                 ['Damage ratio', '120px']], '0'));
      for (var i = 0; i < c.depths_m.length; i++) {
        tableHolder.add(zrow([
          [c.depths_m[i].toFixed(2), {width: '110px', color: COL.ink}],
          [pct(c.ratios[i]), {width: '120px', color: COL.critical,
                              fontWeight: 'bold'}],
        ]));
      }
    }
  }

  curveSel.onChange(showCurve);
  showCurve('residential');

  content.add(head('Aliases — convenience names'));
  content.add(ui.Label(
    'Alternate keys mapping Indonesian / Jitupasna / DIBI vocabulary to ' +
    'the curve names above. Lets call sites use familiar terms: ' +
    'DDF.evaluate("sawah", 1.0) instead of DDF.evaluate("rice_paddy", 1.0). ' +
    'Identical result either way.',
    {fontSize: '10px', color: '666', fontStyle: 'italic',
     margin: '0 0 6px 0'}));
  content.add(tableHead([['Alias', '240px'], ['Resolves to']], '0 0 2px 0'));
  Object.keys(DDF.ALIASES).forEach(function(a) {
    content.add(row(a, '→ ' + DDF.ALIASES[a]));
  });
}


// ====================================================================
// 3) PROVINCE_RATIO — BPS Indeks Kemahalan Konstruksi 2025
// ====================================================================
function renderProvinceRatio() {
  var PROV_NAME = {
    '11': 'ACEH',                    '12': 'SUMATERA UTARA',
    '13': 'SUMATERA BARAT',          '14': 'RIAU',
    '15': 'JAMBI',                   '16': 'SUMATERA SELATAN',
    '17': 'BENGKULU',                '18': 'LAMPUNG',
    '19': 'KEP. BANGKA BELITUNG',    '21': 'KEP. RIAU',
    '31': 'DKI JAKARTA (baseline)',  '32': 'JAWA BARAT',
    '33': 'JAWA TENGAH',             '34': 'DI YOGYAKARTA',
    '35': 'JAWA TIMUR',              '36': 'BANTEN',
    '51': 'BALI',                    '52': 'NUSA TENGGARA BARAT',
    '53': 'NUSA TENGGARA TIMUR',     '61': 'KALIMANTAN BARAT',
    '62': 'KALIMANTAN TENGAH',       '63': 'KALIMANTAN SELATAN',
    '64': 'KALIMANTAN TIMUR',        '65': 'KALIMANTAN UTARA',
    '71': 'SULAWESI UTARA',          '72': 'SULAWESI TENGAH',
    '73': 'SULAWESI SELATAN',        '74': 'SULAWESI TENGGARA',
    '75': 'GORONTALO',               '76': 'SULAWESI BARAT',
    '81': 'MALUKU',                  '82': 'MALUKU UTARA',
    '91': 'PAPUA BARAT',             '92': 'PAPUA BARAT DAYA',
    '94': 'PAPUA',                   '95': 'PAPUA SELATAN',
    '96': 'PAPUA TENGAH',            '97': 'PAPUA PEGUNUNGAN',
  };

  content.add(head('PROVINCE_RATIO — BPS IKK 2025 (normalized to DKI Jakarta)'));
  content.add(note('Multiplier for the DKI Jakarta baseline unit_cost. ' +
    'Higher = more expensive to build. All classes (buildings, roads, ' +
    'bridges, ...) share this ratio. Applied per-adm2 in 06_damage_calc.js.'));

  // Cheapest first.
  var codes = Object.keys(UC.PROVINCE_RATIO).sort(function(a, b) {
    return UC.PROVINCE_RATIO[a] - UC.PROVINCE_RATIO[b];
  });

  // Bar color mirrors the table: red above ×1.30, green below ×0.85.
  var chartRows = codes.map(function(code) {
    var v = UC.PROVINCE_RATIO[code];
    var barColor = v > 1.30 ? COL.critical
                 : (v < 0.85 ? COL.good : COL.blue);
    return [PROV_NAME[code] || code,
            {v: v, f: '× ' + v.toFixed(3)},
            barColor];
  });
  content.add(ui.Chart(
    [['Province', 'Ratio × DKI', {role: 'style'}]].concat(chartRows),
    'BarChart', {
      height: 70 + codes.length * 15,
      backgroundColor: COL.surface,
      legend: {position: 'none'},
      bar: {groupWidth: '65%'},
      hAxis: chartAxis({minValue: 0}),
      vAxis: {textStyle: {color: COL.inkSoft, fontSize: 10}},
      chartArea: {left: 170, top: 6, right: 24, height: '92%'},
    }));

  content.add(tableHead([['Code', '48px'], ['Province', '240px'],
                         ['Ratio × DKI', '100px'], ['vs Aceh (0.85)', '120px']],
                        '4px 0 2px 0'));
  codes.forEach(function(code) {
    var v = UC.PROVINCE_RATIO[code];
    var name = PROV_NAME[code] || ('(code ' + code + ')');
    var color = v > 1.30 ? COL.critical : (v < 0.85 ? COL.good : COL.ink);
    var bold  = v > 1.20 || v < 0.85;
    var vsAceh = (v / 0.846);
    content.add(zrow([
      [code, {width: '48px', color: COL.inkSoft}],
      [name, {width: '240px', color: '#333333'}],
      ['× ' + v.toFixed(3), {width: '100px', color: color,
                             fontWeight: bold ? 'bold' : 'normal'}],
      ['× ' + vsAceh.toFixed(2), {width: '120px', color: COL.inkSoft}],
    ]));
  });

  content.add(head('Coverage'));
  content.add(row('total provinces',   String(codes.length)));
  content.add(row('cheapest',          'SULAWESI BARAT (× 0.785)'));
  content.add(row('most expensive',    'PAPUA PEGUNUNGAN (× 2.109)'));
  content.add(row('baseline',          'DKI JAKARTA (× 1.000)'));
  content.add(row('data source',       'BPS IKK 2025 (dataset_inventory.xlsx / Ratio for Construction)'));
}


// ====================================================================
// 4) CROPS & FISH per m² (from Cost sheet Column G / Crop and vege / Fish)
// ====================================================================
function renderCropsFish() {
  content.add(head('CROPS_PER_M2 — annual production loss (IDR/m²)'));
  content.add(note('From 2025 BPS: national production × price / harvested area. ' +
    'Multiply by 10,000 to get IDR/ha.'));

  var cropKeys = Object.keys(UC.CROPS_PER_M2).sort(function(a, b) {
    return UC.CROPS_PER_M2[b] - UC.CROPS_PER_M2[a];   // desc
  });

  content.add(ui.Chart(
    [['Crop', 'IDR / m²']].concat(cropKeys.map(function(k) {
      var v = UC.CROPS_PER_M2[k];
      return [k, {v: v, f: v.toLocaleString() + ' IDR/m²'}];
    })), 'BarChart', {
      height: 60 + cropKeys.length * 18,
      colors: [COL.blue],
      backgroundColor: COL.surface,
      legend: {position: 'none'},
      bar: {groupWidth: '62%'},
      hAxis: chartAxis({minValue: 0, format: 'short'}),
      vAxis: {textStyle: {color: COL.inkSoft, fontSize: 10}},
      chartArea: {left: 140, top: 6, right: 24, height: '90%'},
    }));

  content.add(tableHead([['Crop', '160px'], ['IDR/m²', '100px'],
                         ['IDR/ha', '160px']], '4px 0 2px 0'));
  cropKeys.forEach(function(k) {
    var v = UC.CROPS_PER_M2[k];
    content.add(zrow([
      [k, {width: '160px', color: '#333333'}],
      [v.toLocaleString(), {width: '100px',
                            color: v > 30000 ? COL.critical : COL.ink,
                            fontWeight: v > 30000 ? 'bold' : 'normal'}],
      [idr(v * 10000) + ' / ha', {width: '160px', color: COL.inkSoft}],
    ]));
  });

  content.add(head('FISH_PER_M2 — aquaculture per m² (IDR/m²)'));
  content.add(note('= density (kg/m²) × market price (IDR/kg). ' +
    '⚠ marks entries flagged "Too Cheap?" in the source spreadsheet.'));

  content.add(tableHead([['Type', '160px'], ['IDR/m²', '120px'],
                         ['IDR/ha', '160px']], '4px 0 2px 0'));
  var flagged = {seaweed: true, milkfish: true, tiger_shrimp: true};
  Object.keys(UC.FISH_PER_M2).forEach(function(k) {
    var v = UC.FISH_PER_M2[k];
    var isFlagged = flagged[k];
    content.add(zrow([
      [(isFlagged ? '⚠ ' : '') + k,
       {width: '160px', color: isFlagged ? '#bf6f00' : '#333333'}],
      [v.toLocaleString(), {width: '120px', color: COL.ink}],
      [idr(v * 10000) + ' / ha', {width: '160px', color: COL.inkSoft}],
    ]));
  });

  content.add(head('INDUSTRY_ALT — alternative per-worker methodologies'));
  content.add(note('Depreciation of Capital Goods (production loss proxy) and ' +
    'Business Interruption Loss (per worker per day). Not currently used by ' +
    '06_damage_calc.js; retained for advanced users.'));

  content.add(head('Depreciation / worker'));
  ['dep_food_per_worker', 'dep_beverage_per_worker', 'dep_textile_per_worker',
   'dep_automotive_per_worker', 'dep_metals_per_worker'].forEach(function(k) {
    content.add(row(k, idr(UC.INDUSTRY_ALT[k])));
  });
  content.add(head('Business interruption / worker / day'));
  ['bil_tobacco_per_worker_day', 'bil_apparel_per_worker_day',
   'bil_electronics_per_worker_day', 'bil_automotive_per_worker_day'].forEach(function(k) {
    content.add(row(k, idr(UC.INDUSTRY_ALT[k])));
  });
}


// ====================================================================
// 5) EXPOSURE — BNPB GIS Assets + GEE public catalog layers, and the
//    "Verify every Asset" existence probe
// ====================================================================
function renderExposure() {
  content.add(head('Exposure & reference datasets'));
  content.add(note('GIS layers used to count submerged assets, plus the ' +
    'public catalog rasters used for population, buildings and land cover. ' +
    'Source attribution below points to the canonical producing K/L ' +
    '(ministry/agency) and the BIG Ina-Geoportal where all national ' +
    'geospatial data is aggregated: https://tanahair.indonesia.go.id'));

  // items = [name, source, meta, dibi_col, notes]
  var groups = [
    {
      title: 'Admin boundaries — BIG (https://geoservices.big.go.id/rbi)',
      items: [
        ['adm1 (Province)',  C.ASSETS.adm1, '38 prov',  'province_id',
          'aggregation key'],
        ['adm2 (Kab/Kota)',  C.ASSETS.adm2, '514 kab/kota', 'city_id',
          'main aggregation unit; city_id comes from DIBI_PCODE'],
        ['adm3 (Kecamatan)', C.ASSETS.adm3, '7,287',   '—',
          'finer breakdown (optional)'],
      ],
    },
    {
      title: 'Hazard / land-cover rasters',
      items: [
        ['Sentinel-1 GRD',          C.PUBLIC.s1,          '10 m, 12-day',
          '_flood_extent_ha', 'Stage 1 flood mask'],
        ['JRC Global Surface Water', C.PUBLIC.jrcWater,    '30 m',
          '—', 'optional FwDET water-source extension (off by default)'],
        ['HydroSHEDS DEM (slope)',   C.PUBLIC.hydroSHEDS,  '90 m',
          '—', 'slope filter for false flood'],
        ['FABDEM (bare-earth DEM)',   C.DEM_FABDEM, '30 m, global',
          '—', 'FwDET depth input (Stage 1). CC BY-NC-SA 4.0'],
        ['RF LULC 2025 (in-house)',  C.ASSETS.lulc, '30 m, 7 classes',
          'rice_field / land / forest_impacted',
          'Random-Forest map: 1 Rice · 2 Corn · 3 Sand · 4 Forest · ' +
          '5 City · 6 Water · 7 Palm oil. Drives all land_cover_ha classes.'],
        ['InaRISK population (BNPB)', C.ASSETS.pop,        '30 m, people/px',
          'suffered',
          'affected population. National sum 286.7 M, 1.061x the 2020 ' +
          'census — a mid-2020s projection; InaRISK states no year. ' +
          'Replaced WorldPop 2026-10-06.'],
        ['GHSL POP 2020',            C.PUBLIC.ghslPop,     '100 m',
          '—', 'population cross-check'],
        ['VIDA buildings (Google+MS)', C.PUBLIC.openBuildings, 'polygons',
          'submerged / house_damaged',
          'building count exposed. Switched 2026-08-19 from Google Open ' +
          'Buildings v3 to the VIDA combined set (Google + Microsoft, IDN ' +
          'split). Microsoft footprints have no confidence value — filter ' +
          'via C.buildingsFC(), never a bare gte(confidence).'],
      ],
    },
    {
      title: 'Sosial: Health — Kemenkes · via BIG (BNPB/exposure/, buffered polygons)',
      items: [
        ['Hospitals (Rumah Sakit)', C.EXPOSURE_POLY.hospitals, '2,346',
          'health_damaged', 'damage class "health" (polygon_area_m2)'],
        ['Puskesmas',    C.EXPOSURE_POLY.puskesmas,  '9,837',
          'health_damaged', 'damage class "health"'],
        ['Klinik (OSM)', C.EXPOSURE_POLY.clinics,    '4,780',
          'health_damaged',
          'HOTOSM export via HDX (ODbL). Name-filtered, then deduped 200 m ' +
          'against the two layers above — OSM double-tags many puskesmas ' +
          'and hospitals as clinics, and D-2 counts units.'],
      ],
    },
    {
      title: 'Sosial: Education — Kemendikbud Dapodik + Kemenag · via BIG',
      items: [
        ['Schools (Sekolah)', C.EXPOSURE_POLY.schools, '472,206',
          'education_damaged', 'consolidated single asset (was 37 prov)'],
        ['Madrasah',       C.EXPOSURE_POLY.madrasah,      '54,852',
          'education_damaged', 'Islamic schools'],
        ['Universities',   C.EXPOSURE_POLY.universities,  '119',
          'education_damaged', 'perguruan tinggi'],
        ['Sekolah Rakyat', C.EXPOSURE_POLY.sekolah_rakyat,'166',
          'education_damaged', 'community schools'],
      ],
    },
    {
      title: 'Sosial: Heritage / Worship / Public services',
      items: [
        ['Cultural heritage', C.EXPOSURE_POLY.cultural_heritage, '167',
          '—', 'count only (expert valuation)'],
        ['Temples (Candi)',   C.EXPOSURE_POLY.temples, '21',
          '—', 'count only'],
        ['Worship (OSM)',     C.EXPOSURE_POLY.worship, '88,100',
          '—', 'damage class "worship"'],
        ['Gov office (OSM)',  C.EXPOSURE_POLY.offices, '22,756',
          '—', 'damage class "office"'],
        ['Market (OSM)',      C.EXPOSURE_POLY.markets, '5,795',
          '—', 'damage class "market"'],
      ],
    },
    {
      title: 'Ekonomi (OSM) — commerce / industry',
      items: [
        ['Factory (Pabrik)', C.EXPOSURE_POLY.factories, '18,075',
          '—', 'damage class "factory"'],
        ['Shop / Ruko',      C.EXPOSURE_POLY.shops,     '54,786',
          '—', 'damage class "shop"'],
        ['Hotel',            C.EXPOSURE_POLY.hotels,    '11,468',
          '—', 'damage class "hotel"'],
        ['Fuel (SPBU)',      C.EXPOSURE_POLY.fuel,      '5,067',
          '—', 'damage class "fuel"'],
      ],
    },
    {
      title: 'Infrastruktur: Transport (Kemenhub / Bina Marga / BNPP)',
      items: [
        ['Bridges (Jembatan)', C.EXPOSURE_POLY.bridges, '2,999',
          'bridge_damaged', 'count only (length unknown)'],
        ['Airports (Bandara)', C.EXPOSURE_POLY.airports, '528',
          'transport_network_damaged', 'count only'],
        ['Seaports (Pelabuhan)', C.EXPOSURE_POLY.seaports, '412',
          'transport_network_damaged', 'count only'],
        ['Land border post (PLBN)', C.EXPOSURE_POLY.border_posts, '17',
          'transport_network_damaged', 'count only'],
        ['Road — Nasional (line)', C.EXPOSURE_POLY.road_nas, '3,306',
          'road_impacted', 'damage class "road_nas" (line_km)'],
        ['Road — Daerah (line)',   C.EXPOSURE_POLY.road_daerah, '2,000',
          'road_impacted', 'damage class "road_daerah" (line_km)'],
        ['Road — Tol (line)',      C.EXPOSURE_POLY.road_tol, '152',
          'road_impacted', 'damage class "road_tol" (line_km, re-uploaded)'],
      ],
    },
    {
      title: 'Infrastruktur: Electricity — Kemen-ESDM + PLN',
      items: [
        ['Substation (Gardu Induk)', C.EXPOSURE_POLY.substations, '2,913',
          'electricity_network_damaged', 'count only (capacity unknown)'],
        ['Power plant (Pembangkit)', C.EXPOSURE_POLY.power_plants, '3,588',
          'electricity_network_damaged', 'count only'],
        ['Geothermal (PLTP)',        C.EXPOSURE_POLY.geothermal, '24',
          'electricity_network_damaged', 'count only'],
        ['Transmission line (line)', C.EXPOSURE_POLY.powerline, '1,595',
          'electricity_network_damaged', 'damage class "powerline" (line_km)'],
      ],
    },
    {
      title: 'Infrastruktur: Water resources & protection — Kemen-PUPR Ditjen SDA',
      items: [
        ['Dam (Bendungan)',   C.EXPOSURE_POLY.dams,       '241',
          '—', 'count only'],
        ['Weir (Bendung)',    C.EXPOSURE_POLY.weirs,      '1,402',
          '—', 'count only'],
        ['Reservoir (Embung)',C.EXPOSURE_POLY.reservoirs, '2,000',
          '—', 'count only'],
        ['Lake (Danau)',      C.EXPOSURE_POLY.lakes,      '233',
          '—', 'natural water (LCLU overlap)'],
        ['Pond (Situ)',       C.EXPOSURE_POLY.ponds,      '422',
          '—', 'natural water (LCLU overlap)'],
        ['Spring (Mata Air)', C.EXPOSURE_POLY.springs,    '695',
          '—', 'natural point'],
        ['Irrigation (command area, POLYGON)', C.EXPOSURE_POLY.irrigation, '310',
          '—', 'damage class DROPPED — overlaps LCLU cropland'],
        ['Water treatment (IPA SPAM)', C.EXPOSURE_POLY.water_treatment, '2,267',
          '—', 'count only'],
        ['Flood pump',        C.EXPOSURE_POLY.pumps,      '264',
          '—', 'count only'],
        ['Coastal protection',C.EXPOSURE_POLY.coastal,    '851',
          '—', 'count only'],
        ['Monitoring station',C.EXPOSURE_POLY.stations,   '3,246',
          '—', 'count only'],
      ],
    },
  ];

  groups.forEach(function(g) {
    content.add(head(g.title));
    content.add(tableHead([['Layer', '190px'], ['Count', '110px'],
                           ['Feeds DIBI column', '220px'], ['Notes']],
                          '2px 0'));
    g.items.forEach(function(it) {
      var src = it[1], col = it[3];
      // Private Asset paths are storage locations, not attribution (the
      // group title names the producer); public catalog IDs are shown.
      var isPrivateAsset = (typeof src === 'string') &&
        (src.indexOf('projects/') === 0 ||
         src.indexOf('users/')    === 0 ||
         src.indexOf('BNPB/')     === 0);
      content.add(zrow([
        function(bg) {
          var nameWidgets = [
            ui.Label(it[0], {fontSize: '11px', color: COL.ink, margin: '0',
                             fontWeight: 'bold', backgroundColor: bg})];
          if (!isPrivateAsset && src) {
            nameWidgets.push(ui.Label(src,
              {fontSize: '9px', color: COL.muted, margin: '0',
               fontStyle: 'italic', backgroundColor: bg}));
          }
          return ui.Panel(nameWidgets, ui.Panel.Layout.flow('vertical'),
            {margin: '0 6px 0 0', width: '190px', backgroundColor: bg});
        },
        [it[2], {width: '110px', color: COL.ink}],
        [col, {width: '220px',
               color: col === '—' ? COL.muted : COL.critical,
               fontWeight: col === '—' ? 'normal' : 'bold'}],
        [it[4], {color: COL.inkSoft}],
      ], '1px 0'));
    });
  });

  content.add(head('Coverage summary'));
  content.add(row('K/L exposure groups (via BIG)', String(groups.length - 2)));
  content.add(row('Hazard / land-cover raster layers', '8'));
  content.add(row('Total exposure layers',
    String(groups.reduce(function(s, g) { return s + g.items.length; }, 0))));
  // Keep in sync with 01_dashboard.js exportDibi() DIBI_MAP / selectors.
  content.add(row('Used to fill DIBI columns',
    'submerged, house_damaged, education_damaged, health_damaged, ' +
    'electricity_network_damaged, road_impacted, ' +
    'rice_field_impacted, land_impacted, plantation_impacted, forest_impacted'));

  // ---- Verify every Asset ----
  // A missing source Asset stops the whole run inside the damage engine
  // ("Collection.loadTable: ... not found"), far from the catalog entry.
  // Probed asynchronously (ee.data.getAsset with a callback): 40-odd
  // synchronous round trips would freeze the page.
  content.add(head('Are these Assets actually there?'));
  content.add(note('One probe per Asset the pipeline names. Nothing is ' +
    'checked until you press the button — the rest of this page stays ' +
    'client-side and instant.'));

  var verifyBtn = ui.Button({label: 'Verify every Asset'});
  content.add(verifyBtn);
  var verifyHolder = ui.Panel({style: {margin: '4px 0 0 12px'}});
  content.add(verifyHolder);

  verifyBtn.onClick(function() {
    verifyHolder.clear();
    verifyBtn.setDisabled(true);

    var targets = [];
    Object.keys(C.EXPOSURE_POLY).forEach(function(k) {
      targets.push({label: 'EXPOSURE_POLY.' + k, id: C.EXPOSURE_POLY[k]});
    });
    ['adm1', 'adm2', 'adm3', 'lulc'].forEach(function(k) {
      targets.push({label: 'ASSETS.' + k, id: C.ASSETS[k]});
    });

    var summary = ui.Label('Checking ' + targets.length + ' Assets...',
      {fontSize: '11px', fontWeight: 'bold', color: COL.inkSoft,
       margin: '0 0 4px 0'});
    verifyHolder.add(summary);

    var done = 0, missing = 0;
    _z = 0;
    targets.forEach(function(t) {
      var line = zrow([
        [t.label, {width: '240px', color: COL.inkSoft}],
        ['checking...', {width: '110px', color: COL.muted}],
        [t.id.split('/').pop(), {fontSize: '10px', color: COL.muted,
                                 fontStyle: 'italic'}],
      ]);
      verifyHolder.add(line);

      ee.data.getAsset(t.id, function(res, err) {
        var ok = !err && !!res;
        if (!ok) missing++;
        line.widgets().get(1)
          .setValue(ok ? '✓ present' : '✗ NOT FOUND')
          .style().set('color', ok ? COL.good : COL.critical);
        done++;
        if (done === targets.length) {
          summary.setValue(missing === 0
            ? '✓ all ' + targets.length + ' Assets present'
            : '✗ ' + missing + ' of ' + targets.length + ' MISSING — the ' +
              'pipeline will stop on the first one it reaches. Ingest it, ' +
              'or drop it from the catalog in 01_constants.js.');
          summary.style().set('color', missing === 0 ? COL.good : COL.critical);
          verifyBtn.setDisabled(false);
        }
      });
    });
  });
}


// ====================================================================
// 6) SANITY TEST — worked example with the full pipeline formula
//    damage = qty × unit × DDF(depth) × province_ratio
// ====================================================================
function renderSanity() {
  content.add(head('Example: 36 m² house @ 1.5 m flood (DKI Jakarta)'));
  var d       = 1.5;
  var prov    = UC.provinceRatio('31');          // DKI Jakarta = 1.00
  var ratio   = DDF.evaluate('residential', d);
  var base    = UC.HOUSING.rb_per_m2 * UC.HOUSING.avg_floor_m2;
  var scaled  = base * prov;
  var dmg     = scaled * ratio;
  content.add(row('Flood depth',                    d.toFixed(2) + ' m'));
  content.add(row('DDF ratio (residential)',        pct(ratio)));
  content.add(row('Base cost (house/m² × area)',    idr(base), {bold: true}));
  content.add(row('Province ratio (Jakarta = 1.00)','× ' + prov.toFixed(3)));
  content.add(row('Locally scaled cost',            idr(scaled)));
  content.add(row('= Damage value',                 idr(dmg),
                  {bold: true, color: 'bf0f19'}));

  content.add(head('Same house, same depth, ACROSS PROVINCES'));
  [['11', 'ACEH'], ['31', 'DKI JAKARTA'], ['34', 'DI YOGYAKARTA'],
   ['32', 'JAWA BARAT'], ['51', 'BALI'], ['64', 'KALIMANTAN TIMUR'],
   ['81', 'MALUKU'], ['91', 'PAPUA BARAT'], ['94', 'PAPUA'],
   ['96', 'PAPUA TENGAH'], ['97', 'PAPUA PEGUNUNGAN']].forEach(function(p) {
    var f  = UC.provinceRatio(p[0]);
    var dv = base * f * ratio;
    content.add(row(p[0] + ' ' + p[1],
      idr(dv) + '   (× ' + f.toFixed(3) + ')',
      {color: f > 1.30 ? 'bf0f19' : (f < 0.85 ? '0a6f00' : '222'),
       bold:  f > 1.20 || f < 0.85}));
  });

  content.add(head('Same house, varying depth (Jakarta, PROV=1.00)'));
  var DEPTH_STEPS = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0];
  content.add(ui.Chart(
    [['Depth', 'Damage (Rp million)']].concat(DEPTH_STEPS.map(function(d) {
      var r = DDF.evaluate('residential', d);
      return [d.toFixed(2) + ' m', {v: base * r / 1e6, f: idr(base * r)}];
    })), 'ColumnChart', {
      height: 220,
      colors: [COL.blue],
      backgroundColor: COL.surface,
      legend: {position: 'none'},
      bar: {groupWidth: '55%'},
      hAxis: {textStyle: {color: COL.muted, fontSize: 10}},
      vAxis: chartAxis({title: 'Rp million', minValue: 0,
                        titleTextStyle: {color: COL.muted, italic: false}}),
      chartArea: {left: 70, top: 10, right: 16, height: '75%'},
    }));
  DEPTH_STEPS.forEach(function(d) {
    var r = DDF.evaluate('residential', d);
    content.add(row('depth ' + d.toFixed(2) + ' m',
      pct(r) + '   →  ' + idr(base * r)));
  });
}


// ====================================================================
// 7) ENGINE TEST — the per-pixel DDF and the separate 100 m population
//    pass both produce plausible-looking wrong numbers when broken, so
//    each test fails loudly:
//      T1  evaluateImage vs evaluate (all curves must agree)
//      T2  hand calculation (one house)
//      T3  population scale (catches the 100× resolution trap)
//      T4  the per-city measurements on a real event
// ====================================================================
function renderEngineTest() {
  function sub(t, size, margin) {
    return ui.Label(t, {fontSize: size, fontWeight: 'bold', color: '333',
                        margin: margin});
  }
  function hint(t, margin) {
    return ui.Label(t, {fontSize: '10px', color: '777', margin: margin});
  }
  function errLabel(t) {
    return ui.Label(t, {fontSize: '11px', color: 'c00'});
  }

  content.add(ui.Label('Engine Test — 2026-08-05 rewrite verification', {
    fontSize: '14px', fontWeight: 'bold', color: '1a3d6d', margin: '0 0 2px 0',
  }));
  content.add(hint(
    'T1 and T2 run immediately. T4 needs an event id and costs a server call.',
    '0 0 10px 0'));

  // ---------- T1: image vs scalar DDF ----------
  content.add(sub('T1 · evaluateImage vs evaluate (all curves)', '12px',
                  '8px 0 4px 0'));
  content.add(hint(
    'Both implementations walk the same control points; a mismatch means the ' +
    'per-pixel path has drifted from the reference curve.', '0 0 4px 0'));

  var t1Holder = ui.Panel({style: {margin: '0 0 6px 12px'}});
  content.add(t1Holder);

  var DEPTHS = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0];
  Object.keys(DDF.CURVES).forEach(function(curveKey) {
    var line = ui.Panel([
      ui.Label(curveKey, {fontSize: '11px', width: '150px', color: '333'}),
      ui.Label('checking...', {fontSize: '11px', color: '888'}),
    ], ui.Panel.Layout.flow('horizontal'), {margin: '0'});
    t1Holder.add(line);

    // Sample the ratio image at each test depth via a constant depth image.
    var imgVals = ee.List(DEPTHS.map(function(d) {
      return DDF.evaluateImage(curveKey, ee.Image.constant(d))
                .reduceRegion({
                  reducer: ee.Reducer.first(),
                  geometry: ee.Geometry.Point([106.8, -6.2]).buffer(30),
                  scale: 30,
                }).values().get(0);
    }));

    imgVals.evaluate(function(vals, err) {
      if (err || !vals) {
        line.widgets().get(1).setValue('ERROR ' + err)
           .style().set('color', 'c00');
        return;
      }
      var worst = 0, worstAt = null;
      DEPTHS.forEach(function(d, i) {
        var expected = DDF.evaluate(curveKey, d);
        var diff = Math.abs((vals[i] === null ? 0 : vals[i]) - expected);
        if (diff > worst) { worst = diff; worstAt = d; }
      });
      var ok = worst < 1e-6;
      line.widgets().get(1)
        .setValue(ok ? '✓ match (max diff ' + worst.toExponential(1) + ')'
                     : '✗ MISMATCH ' + worst.toFixed(4) + ' at ' + worstAt + ' m')
        .style().set('color', ok ? '060' : 'c00');
    });
  });

  // ---------- T2: hand calculation ----------
  content.add(sub('T2 · hand calculation', '12px', '12px 0 4px 0'));
  var floor = UC.HOUSING.avg_floor_m2;          // 36 m²
  var rate  = UC.HOUSING.rb_per_m2;             // 6,230,000 IDR/m²
  var ratio = DDF.evaluate('residential', 1.5); // 0.50
  var expect = floor * rate * ratio * 1.00;     // DKI Jakarta, ratio 1.00
  content.add(ui.Label(
    floor + ' m² × Rp ' + rate.toLocaleString() + '/m² × DDF(residential, ' +
    '1.5 m)=' + ratio.toFixed(2) + ' × province_ratio 1.00',
    {fontSize: '11px', color: '333', margin: '0 0 2px 12px'}));
  content.add(ui.Label('= Rp ' + Math.round(expect).toLocaleString(), {
    fontSize: '12px', fontWeight: 'bold', color: '060', margin: '0 0 4px 12px',
  }));
  content.add(hint(
    'Cross-check this against one housing row of a real Jitupasna CSV: ' +
    'damage_idr ÷ (quantity × unit_cost_idr) must equal that row\'s ddf_ratio.',
    '0 0 4px 12px'));

  // ---------- T3 + T4: need an event ----------
  content.add(sub('T3 · population scale   /   T4 · old vs new totals', '12px',
                  '12px 0 4px 0'));
  content.add(hint(
    'T3 is the 9× guard: InaRISK is a 30 m people-per-pixel grid, so ' +
    'reducing it at 10 m would replicate every value 9 times. Exposed ' +
    'population must never exceed the districts\' total population. ' +
    'It checks the gridded path — floods, landslides and fires. An earthquake\'s ' +
    'published population comes from building counts instead, so this ' +
    'test does not cover it.', '0 0 4px 0'));

  var evtBox = ui.Textbox({
    placeholder: 'event id, e.g. jakarta_2025_nov_20260804',
    style: {width: '320px'},
  });
  var runBtn = ui.Button({label: 'Run T3 + T4'});
  content.add(ui.Panel([evtBox, runBtn],
    ui.Panel.Layout.flow('horizontal'), {margin: '0 0 6px 0'}));

  var resHolder = ui.Panel({style: {margin: '0 0 6px 12px'}});
  content.add(resHolder);

  runBtn.onClick(function() {
    var evt = evtBox.getValue();
    resHolder.clear();
    if (!evt) {
      resHolder.add(errLabel('Enter an event id first.'));
      return;
    }
    resHolder.add(ui.Label('Running (one server call)...',
      {fontSize: '11px', color: '888'}));

    var DMG = require('users/kurihara-yt/dibi:01_shared/06_damage_calc');
    var CLS = require('users/kurihara-yt/dibi:01_shared/04_damage_classes');

    var fc, totalPop;
    try {
      // The overview, not the full valuation: same population arithmetic,
      // but it stays inside the five-minute interactive limit on a
      // province-scale event.
      fc = DMG.computeOverviewFC(evt);

      // Total population of the affected districts — the ceiling for T3.
      var mask  = C.floodExtentImage(evt).gt(0).selfMask();   // observed OR inferred
      var adm2  = ee.FeatureCollection(C.ASSETS.adm2).filterBounds(mask.geometry());
      // InaRISK is one national image, so there is no collection to filter
      // and the projection comes straight off it. unmask(0) matches what
      // 06_damage_calc.js sums, so the ceiling is on the same footing.
      var popImg  = ee.Image(CLS.POPULATION.asset);
      var popProj = popImg.projection();
      totalPop = popImg.unmask(0).reduceRegions({
        collection: adm2, reducer: ee.Reducer.sum().setOutputs(['pop']),
        scale: popProj.nominalScale(), tileScale: 8,
      }).aggregate_sum('pop');
    } catch (e) {
      resHolder.clear();
      resHolder.add(errLabel('Pipeline error: ' + e));
      return;
    }

    ee.Dictionary({rows: fc, totalPop: totalPop}).evaluate(function(res, err) {
      resHolder.clear();
      if (err || !res) {
        resHolder.add(errLabel('Failed: ' + err));
        return;
      }

      // The overview is one row per city with plain measurement properties.
      var popExposed = 0, floodHa = 0;
      var cities = [];
      res.rows.features.forEach(function(f) {
        var p = f.properties;
        if (!(p.flood_ha > 0)) return;
        popExposed += (p.pop_exposed || 0);
        floodHa    += (p.flood_ha    || 0);
        cities.push(p);
      });
      cities.sort(function(a, b) {
        return (b.pop_exposed || 0) - (a.pop_exposed || 0);
      });

      // ---- T3 verdict ----
      var ceiling = res.totalPop || 0;
      var t3ok = (ceiling > 0) && (popExposed <= ceiling);
      resHolder.add(sub('T3 · population scale', '11px', '0 0 2px 0'));
      resHolder.add(ui.Label(
        'in the flood ' + Math.round(popExposed).toLocaleString() +
        '   /   districts total ' + Math.round(ceiling).toLocaleString() +
        '   =   ' +
        (ceiling > 0 ? (100 * popExposed / ceiling).toFixed(1) : '?') + ' %',
        {fontSize: '11px', color: '333', margin: '0 0 2px 12px'}));
      resHolder.add(ui.Label(
        t3ok ? '✓ within the district population'
             : '✗ EXCEEDS the district population. The population raster is ' +
               '~92.8 m; if it is being reduced on a 10 m grid every value is ' +
               'counted 100 times. A ratio near 100x means exactly that.',
        {fontSize: '11px', color: t3ok ? '060' : 'c00',
         fontWeight: 'bold', margin: '0 0 8px 12px'}));

      // ---- T4: the measurements themselves ----
      resHolder.add(sub('T4 · what was measured, by city', '11px', '0 0 2px 0'));
      resHolder.add(hint(
        'Sanity-check the inputs before trusting any valuation built on them: ' +
        'a flooded area larger than the city, or a mean depth of tens of ' +
        'metres, means the problem is upstream in Step 1, not in the costs.',
        '0 0 4px 12px'));

      cities.slice(0, 15).forEach(function(c) {
        resHolder.add(ui.Panel([
          ui.Label(c.city_name, {fontSize: '10px', width: '150px', color: '333'}),
          ui.Label(Math.round(c.pop_exposed).toLocaleString() + ' people',
                   {fontSize: '10px', width: '110px', color: '333'}),
          ui.Label(Math.round(c.flood_ha).toLocaleString() + ' ha',
                   {fontSize: '10px', width: '90px', color: '333'}),
          ui.Label((c.depth_mean_m || 0).toFixed(2) + ' m',
                   {fontSize: '10px', color: '777'}),
        ], ui.Panel.Layout.flow('horizontal'), {margin: '0 0 0 12px'}));
      });
      if (cities.length > 15) {
        resHolder.add(ui.Label('and ' + (cities.length - 15) + ' more.',
          {fontSize: '10px', color: '888', margin: '0 0 0 12px'}));
      }

      resHolder.add(ui.Label(
        'Total: ' + Math.round(floodHa).toLocaleString() + ' ha under water ' +
        'across ' + cities.length + ' cities.', {
        fontSize: '12px', fontWeight: 'bold', color: '060',
        margin: '6px 0 0 12px'}));
      resHolder.add(hint(
        'Per-class damage totals are no longer checked here: valuing a whole ' +
        'province cannot finish inside the interactive time limit. Check them ' +
        'by clicking a city in Step 2, or in the saved CSV.',
        '4px 0 0 12px'));
    });
  });
}


render(SECTIONS[0]);
