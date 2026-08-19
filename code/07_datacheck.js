/**
 * 01_shared/07_datacheck.js — read-only inspector for the shared constants.
 *
 * Purpose:
 *   Sanity-check the inputs that feed 06_damage_calc.js BEFORE running a
 *   per-event pipeline. Nothing in this file does any server-side
 *   computation (no ee.Reducer, no reduceRegions, no Export). Render is
 *   instant because every value is already on the client side.
 *
 * Sections (chosen from the dropdown at the top of the page):
 *
 *     Unit Costs      — every entry of UC.* with its source reference
 *                       (Cost sheet Column G, or the Column J reference
 *                        cited by its primary source and marked [J]).
 *     DDF Curves      — line chart for one curve OR an overlay of all,
 *                       plus a depth-vs-ratio table at common depths.
 *     Province Ratio  — UC.PROVINCE_RATIO (BPS IKK 2025), the single
 *                       regional cost multiplier used by damage_calc.
 *     Crops & Fish    — per-m² crop / aquaculture production values.
 *     Exposure        — every GIS asset path used by the pipeline with
 *                       producing K/L, feature count, DIBI column it feeds.
 *     Sanity Test     — worked example: 1 house @ 1.5 m flood in Jakarta,
 *                       then the same calc across provinces to show how
 *                       PROVINCE_RATIO changes the result.
 *
 * Structure: a single `render(sectionName)` dispatcher routes to one
 * renderXxx() function per section. Each only writes UI widgets to `content`.
 *
 * Chrome (2026-08-07): full-screen dashboard styling shared with
 * 01_dashboard.js — dark header bar with the section selector, a KPI tile
 * row (all counts client-side), a white content card, zebra-striped tables,
 * and client-side charts (DDF curves, province ratios, crop values, damage
 * vs depth) on the validated data-viz palette.
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


// ====================================================================
// Palette — same validated light-mode data-viz palette as 01_dashboard.js.
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

// Zebra striping for hand-built tables: head() resets the counter, every
// data row calls zbg() for its background. Rendering is strictly
// sequential, so one module-level counter is enough.
var _z = 0;
function zbg() { return (_z++ % 2 === 0) ? COL.surface : '#f3f2ef'; }

// A KPI stat tile: caption on top, big value, small sub-line.
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


// ====================================================================
// References — mapping from each unit-cost key to its source.
// Values updated 2026-07-03 to Cost sheet Column G ("from Statistical Data
// etc.") for classes where G is available, back-calculated to 100 % base
// cost for damage-level tiered items. Where G is empty the Column J
// reference value is retained, but cited by the PRIMARY source that the
// Furukawa Excel itself referenced (SHST, AHSP Bina Marga, PLN RUPTL,
// KLHK, KKP, ...) and marked "[J]" — per dataset_inventory.xlsx Cost
// sheet, "Reference / source" column (2026-08-07).
// ====================================================================
var REF = {
  // C-4 Housing
  'HOUSING.rb_per_m2':   'SHST DKI Jakarta 2025 Rumah Tipe C/D/E [G base]',
  'HOUSING.avg_floor_m2':'BPS Susenas typical simple housing',
  'HOUSING.furniture_per_hh': 'BPS Susenas per-capita non-food exp. proxy',
  'HOUSING.utility_per_unit': 'PLN new connection (1300 VA)',
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
// UI helpers
// ====================================================================
// Labels default to a WHITE background, which shows as white strips on the
// zebra rows — every cell must carry the row's own background color.
function refRow(label, value, refKey, opts) {
  opts = opts || {};
  var bg = zbg();
  return ui.Panel([
    ui.Label(label, {fontSize: '11px', color: COL.inkSoft,
                     margin: '1px 6px 1px 0', width: opts.w || '240px',
                     backgroundColor: bg}),
    ui.Label(value, {fontSize: '11px',
                     color: opts.color || COL.ink,
                     fontWeight: opts.bold ? 'bold' : 'normal',
                     margin: '1px 6px 1px 0', width: '170px',
                     backgroundColor: bg}),
    ui.Label(REF[refKey] || '—',
                    {fontSize: '10px', color: COL.muted, margin: '1px 0',
                     fontStyle: 'italic', backgroundColor: bg}),
  ], ui.Panel.Layout.flow('horizontal'),
     {margin: '0', padding: '1px 4px', backgroundColor: bg});
}
function row(label, value, opts) {
  opts = opts || {};
  var bg = zbg();
  return ui.Panel([
    ui.Label(label, {fontSize: '11px', color: COL.inkSoft,
                     margin: '1px 6px 1px 0', width: opts.w || '240px',
                     backgroundColor: bg}),
    ui.Label(value, {fontSize: '11px',
                     color: opts.color || COL.ink,
                     fontWeight: opts.bold ? 'bold' : 'normal',
                     margin: '1px 0', backgroundColor: bg}),
  ], ui.Panel.Layout.flow('horizontal'),
     {margin: '0', padding: '1px 4px', backgroundColor: bg});
}
function head(t) {
  _z = 0;   // restart zebra striping under every section header
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

ui.root.add(ui.Panel([
  ui.Panel([
    // Every widget inside the dark header needs backgroundColor set
    // explicitly — nested panels AND labels default to white, which
    // renders as white boxes swallowing the white text.
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

// ---------- KPI row — everything below is already client-side ----------
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
var body = ui.Panel({
  style: {stretch: 'both', padding: '8px 14px 14px 14px',
          backgroundColor: COL.page},
  layout: ui.Panel.Layout.flow('vertical'),
});
ui.root.add(body);

var content = ui.Panel({
  style: {stretch: 'both', padding: '4px 14px 14px 14px',
          backgroundColor: COL.surface, border: '1px solid ' + COL.grid},
  layout: ui.Panel.Layout.flow('vertical'),
});
body.add(content);

sectionSelect.onChange(function(v) { render(v); });


// ====================================================================
// Dispatcher
// ====================================================================
function render(name) {
  content.clear();
  if (name === 'Unit Costs')      return renderUnitCosts();
  if (name === 'DDF Curves')      return renderDDF();
  if (name === 'Province Ratio')  return renderProvinceRatio();
  if (name === 'Crops & Fish')    return renderCropsFish();
  if (name === 'Exposure')        return renderExposure();
  if (name === 'Sanity Test')     return renderSanity();
  if (name === 'Engine Test')     return renderEngineTest();
}


// ====================================================================
// 7) ENGINE TEST — verification for the 2026-08-05 damage-engine rewrite.
//
// The rewrite changed two things that cannot be eyeballed: the DDF moved
// from a scalar evaluated on each district's mean depth to an image
// evaluated per pixel, and population moved onto its own 100 m pass. Both
// are the kind of change that produces plausible-looking wrong numbers, so
// each has a test here that fails loudly.
//
//   T1  evaluateImage vs evaluate     — the image and scalar implementations
//                                       must agree on every curve
//   T2  hand calculation              — one house, checked with a calculator
//   T3  population scale              — catches the 100× resolution trap
//   T4  old vs new engine             — per-class deltas on a real event
// ====================================================================
function renderEngineTest() {
  content.add(ui.Label('Engine Test — 2026-08-05 rewrite verification', {
    fontSize: '14px', fontWeight: 'bold', color: '1a3d6d', margin: '0 0 2px 0',
  }));
  content.add(ui.Label(
    'T1 and T2 run immediately. T4 needs an event id and costs a server call.',
    {fontSize: '10px', color: '777', margin: '0 0 10px 0'}));

  // ---------- T1: image vs scalar DDF ----------
  content.add(ui.Label('T1 · evaluateImage vs evaluate (all curves)', {
    fontSize: '12px', fontWeight: 'bold', color: '333', margin: '8px 0 4px 0',
  }));
  content.add(ui.Label(
    'Both implementations walk the same control points; a mismatch means the ' +
    'per-pixel path has drifted from the reference curve.',
    {fontSize: '10px', color: '777', margin: '0 0 4px 0'}));

  var t1Holder = ui.Panel({style: {margin: '0 0 6px 12px'}});
  content.add(t1Holder);

  var DEPTHS = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0];
  Object.keys(DDF.CURVES).forEach(function(curveKey) {
    var row = ui.Panel([
      ui.Label(curveKey, {fontSize: '11px', width: '150px', color: '333'}),
      ui.Label('checking...', {fontSize: '11px', color: '888'}),
    ], ui.Panel.Layout.flow('horizontal'), {margin: '0'});
    t1Holder.add(row);

    // Sample the ratio image at each test depth by feeding it a constant
    // depth image — the cheapest way to compare like with like.
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
        row.widgets().get(1).setValue('ERROR ' + err)
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
      row.widgets().get(1)
        .setValue(ok ? '✓ match (max diff ' + worst.toExponential(1) + ')'
                     : '✗ MISMATCH ' + worst.toFixed(4) + ' at ' + worstAt + ' m')
        .style().set('color', ok ? '060' : 'c00');
    });
  });

  // ---------- T2: hand calculation ----------
  content.add(ui.Label('T2 · hand calculation', {
    fontSize: '12px', fontWeight: 'bold', color: '333', margin: '12px 0 4px 0',
  }));
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
  content.add(ui.Label(
    'Cross-check this against one housing row of a real Jitupasna CSV: ' +
    'damage_idr ÷ (quantity × unit_cost_idr) must equal that row\'s ddf_ratio.',
    {fontSize: '10px', color: '777', margin: '0 0 4px 12px'}));

  // ---------- T3 + T4: need an event ----------
  content.add(ui.Label('T3 · population scale   /   T4 · old vs new totals', {
    fontSize: '12px', fontWeight: 'bold', color: '333', margin: '12px 0 4px 0',
  }));
  content.add(ui.Label(
    'T3 is the 100× guard: WorldPop is a 100 m people-per-pixel grid, so ' +
    'reducing it at 10 m would replicate every value 100 times. Exposed ' +
    'population must never exceed the districts\' total population.',
    {fontSize: '10px', color: '777', margin: '0 0 4px 0'}));

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
      resHolder.add(ui.Label('Enter an event id first.',
        {fontSize: '11px', color: 'c00'}));
      return;
    }
    resHolder.add(ui.Label('Running (one server call)...',
      {fontSize: '11px', color: '888'}));

    var DMG = require('users/kurihara-yt/dibi:01_shared/06_damage_calc');
    var CLS = require('users/kurihara-yt/dibi:01_shared/04_damage_classes');

    var fc, totalPop;
    try {
      // The overview, not the full valuation. It carries the same population
      // arithmetic, runs in seconds, and — unlike computeDamageFC over a whole
      // province — will not hit the five-minute interactive limit, so this
      // test stays runnable on the events that most need checking.
      fc = DMG.computeOverviewFC(evt);

      // Total population of the affected districts — the ceiling for T3.
      var mask  = ee.Image(C.maskAssetFor(evt)).gt(0).selfMask();
      var adm2  = ee.FeatureCollection(C.ASSETS.adm2).filterBounds(mask.geometry());
      var popIC = ee.ImageCollection(CLS.POPULATION.asset)
        .filter(ee.Filter.eq('year', CLS.POPULATION.year))
        .filterBounds(mask.geometry());

      // Summed on WorldPop's own grid, read from a member rather than from the
      // mosaic. Two traps here, and this test is worthless if it falls into
      // either: mosaic() reports EPSG:4326 at 1 degree, and a rounded 100 m
      // grid misses ~14 % of the 92.8 m cells. Either would drag the CEILING
      // down and make a correct result look like a failure — a test that cries
      // wolf is worse than no test.
      var popProj = ee.Image(popIC.first()).projection();
      totalPop = popIC.mosaic().reduceRegions({
        collection: adm2, reducer: ee.Reducer.sum().setOutputs(['pop']),
        scale: popProj.nominalScale(), tileScale: 8,
      }).aggregate_sum('pop');
    } catch (e) {
      resHolder.clear();
      resHolder.add(ui.Label('Pipeline error: ' + e,
        {fontSize: '11px', color: 'c00'}));
      return;
    }

    ee.Dictionary({rows: fc, totalPop: totalPop}).evaluate(function(res, err) {
      resHolder.clear();
      if (err || !res) {
        resHolder.add(ui.Label('Failed: ' + err,
          {fontSize: '11px', color: 'c00'}));
        return;
      }

      // The overview is one row per city, with the measurements as plain
      // properties — not the long per-class format the valuation produces.
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
      resHolder.add(ui.Label('T3 · population scale', {
        fontSize: '11px', fontWeight: 'bold', color: '333', margin: '0 0 2px 0',
      }));
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
      resHolder.add(ui.Label('T4 · what was measured, by city', {
        fontSize: '11px', fontWeight: 'bold', color: '333', margin: '0 0 2px 0',
      }));
      resHolder.add(ui.Label(
        'Sanity-check the inputs before trusting any valuation built on them: ' +
        'a flooded area larger than the city, or a mean depth of tens of ' +
        'metres, means the problem is upstream in Step 1, not in the costs.',
        {fontSize: '10px', color: '777', margin: '0 0 4px 12px'}));

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
      resHolder.add(ui.Label(
        'Per-class damage totals are no longer checked here: valuing a whole ' +
        'province cannot finish inside the interactive time limit. Check them ' +
        'by clicking a city in Step 2, or in the saved CSV.',
        {fontSize: '10px', color: '777', margin: '4px 0 0 12px'}));
    });
  });
}


// ====================================================================
// 1) UNIT COSTS — now with Source column
// ====================================================================
function renderUnitCosts() {
  // Header row for the 3-column layout
  function tblHead() {
    _z = 0;
    return ui.Panel([
      ui.Label('Item',  {fontSize: '11px', fontWeight: 'bold',
                         color: COL.inkSoft, width: '240px', margin: '0 6px 0 0',
                         backgroundColor: COL.page}),
      ui.Label('Value', {fontSize: '11px', fontWeight: 'bold',
                         color: COL.inkSoft, width: '170px', margin: '0 6px 0 0',
                         backgroundColor: COL.page}),
      ui.Label('Reference / Source',
                        {fontSize: '11px', fontWeight: 'bold', color: COL.inkSoft,
                         backgroundColor: COL.page}),
    ], ui.Panel.Layout.flow('horizontal'),
       {margin: '4px 0 2px 0', padding: '2px 4px',
        backgroundColor: COL.page, border: '1px solid ' + COL.grid});
  }

  content.add(note('Indonesian unit costs at 100 % damage (DKI Jakarta 2025 baseline). ' +
    'Multiply by DDF(depth) for damage ratio and PROVINCE_RATIO for locality.'));

  content.add(head('C-4 Housing (Permukiman) — 100 % base'));
  content.add(tblHead());
  content.add(refRow('house / m² (Rumah C/D/E)', idr(UC.HOUSING.rb_per_m2),    'HOUSING.rb_per_m2', {bold: true}));
  content.add(refRow('avg floor area', UC.HOUSING.avg_floor_m2 + ' m²', 'HOUSING.avg_floor_m2'));
  content.add(refRow('furniture / HH', idr(UC.HOUSING.furniture_per_hh), 'HOUSING.furniture_per_hh'));
  content.add(refRow('utility / unit', idr(UC.HOUSING.utility_per_unit), 'HOUSING.utility_per_unit'));

  content.add(head('C-5 Sosial (Buildings, 100 % base)'));
  content.add(tblHead());
  content.add(refRow('hospital / m² (Gedung TS)', idr(UC.INFRA.health_per_m2),    'INFRA.health_per_m2', {bold: true}));
  content.add(refRow('puskesmas / m² (Gedung Sederhana)', idr(UC.INFRA.puskesmas_per_m2), 'INFRA.puskesmas_per_m2'));
  content.add(refRow('university / m² (Gedung TS)', idr(UC.INFRA.university_per_m2), 'INFRA.university_per_m2'));
  content.add(refRow('school / madrasah / m²', idr(UC.INFRA.edu_per_m2),          'INFRA.edu_per_m2'));
  content.add(refRow('worship / m² (masjid raya)', idr(UC.INFRA.worship_per_m2), 'INFRA.worship_per_m2'));
  content.add(refRow('government office / m²', idr(UC.INFRA.gov_office_per_m2),  'INFRA.gov_office_per_m2'));
  content.add(refRow('market / m² (4-story HSB)', idr(UC.INFRA.market_per_m2),   'INFRA.market_per_m2'));

  content.add(head('C-5 Infrastruktur — Roads (per grade)'));
  content.add(tblHead());
  content.add(refRow('road nasional / km',    idr(UC.INFRA.road_nasional_per_km),  'INFRA.road_nasional_per_km', {bold: true}));
  content.add(refRow('road kabupaten / km',   idr(UC.INFRA.road_kabupaten_per_km), 'INFRA.road_kabupaten_per_km'));
  content.add(refRow('road desa / km',        idr(UC.INFRA.road_desa_per_km),      'INFRA.road_desa_per_km'));
  content.add(refRow('road tol / km',         idr(UC.INFRA.road_tol_per_km),       'INFRA.road_tol_per_km'));
  content.add(refRow('road embankment / m³',  idr(UC.INFRA.road_embankment_per_m3),'INFRA.road_embankment_per_m3'));

  content.add(head('C-5 Infrastruktur — Bridges / Power / Water / Telecom'));
  content.add(tblHead());
  content.add(refRow('bridge / m',            idr(UC.INFRA.bridge_per_m),      'INFRA.bridge_per_m'));
  content.add(refRow('bridge avg length',     UC.INFRA.bridge_avg_m + ' m',    'INFRA.bridge_avg_m'));
  content.add(refRow('power line / km',       idr(UC.INFRA.power_line_per_km), 'INFRA.power_line_per_km'));
  content.add(refRow('substation each',       idr(UC.INFRA.substation_each),   'INFRA.substation_each'));
  content.add(refRow('plant / MW',            idr(UC.INFRA.plant_per_mw),      'INFRA.plant_per_mw'));
  content.add(refRow('geothermal / MW (PLTP)',idr(UC.INFRA.geothermal_per_mw), 'INFRA.geothermal_per_mw'));
  content.add(refRow('water treatment / Lps', idr(UC.INFRA.water_treatment_per_lps), 'INFRA.water_treatment_per_lps'));
  content.add(refRow('water supply / m',      idr(UC.INFRA.water_supply_per_m),'INFRA.water_supply_per_m'));
  content.add(refRow('telecom BTS / unit',    idr(UC.INFRA.telecom_per_unit),  'INFRA.telecom_per_unit'));
  content.add(refRow('airport (each)',        idr(UC.INFRA.airport_each),      'INFRA.airport_each'));
  content.add(refRow('seaport (each)',        idr(UC.INFRA.seaport_each),      'INFRA.seaport_each'));
  content.add(refRow('embankment (concrete)/m', idr(UC.INFRA.embankment_per_m), 'INFRA.embankment_per_m'));
  content.add(refRow('mangrove / ha',         idr(UC.INFRA.mangrove_per_ha),   'INFRA.mangrove_per_ha'));

  content.add(head('C-2 Agricultural'));
  content.add(tblHead());
  content.add(refRow('rice GKP / kg',         idr(UC.AGRI.rice_gkp_per_kg),    'AGRI.rice_gkp_per_kg'));
  content.add(refRow('rice milled / kg',      idr(UC.AGRI.rice_milled_per_kg), 'AGRI.rice_milled_per_kg'));
  content.add(refRow('rice GKG / kg',         idr(UC.AGRI.rice_gkg_per_kg),    'AGRI.rice_gkg_per_kg'));
  content.add(refRow('rice yield / ha',       UC.AGRI.rice_yield_kg_per_ha + ' kg', 'AGRI.rice_yield_kg_per_ha'));
  content.add(refRow('perennial replant / ha', idr(UC.AGRI.perennial_replant_per_ha), 'AGRI.perennial_replant_per_ha', {bold: true}));
  content.add(refRow('coffee / kg',           idr(UC.AGRI.coffee_per_kg),      'AGRI.coffee_per_kg'));
  content.add(refRow('cocoa / kg',            idr(UC.AGRI.cocoa_per_kg),       'AGRI.cocoa_per_kg'));
  content.add(refRow('egg / kg',              idr(UC.AGRI.egg_per_kg),         'AGRI.egg_per_kg'));
  content.add(refRow('milk / L',              idr(UC.AGRI.milk_per_l),         'AGRI.milk_per_l'));
  content.add(refRow('cattle / head',         idr(UC.AGRI.cattle_per_head),    'AGRI.cattle_per_head'));
  content.add(refRow('goat / head',           idr(UC.AGRI.goat_per_head),      'AGRI.goat_per_head'));
  content.add(refRow('poultry feed / kg',     idr(UC.AGRI.poultry_feed_per_kg),'AGRI.poultry_feed_per_kg'));
  content.add(refRow('ruminant feed / kg',    idr(UC.AGRI.ruminant_feed_per_kg),'AGRI.ruminant_feed_per_kg'));
  content.add(refRow('beef / kg',             idr(UC.AGRI.beef_per_kg),        'AGRI.beef_per_kg'));
  content.add(refRow('chicken meat / kg',     idr(UC.AGRI.chicken_meat_per_kg),'AGRI.chicken_meat_per_kg'));
  content.add(refRow('beehive (each)',        idr(UC.AGRI.beehive_each),       'AGRI.beehive_each'));
  content.add(refRow('timber / m³',           idr(UC.AGRI.timber_per_m3),      'AGRI.timber_per_m3'));
  content.add(refRow('forest replant proxy / ha', idr(UC.AGRI.timber_per_ha_proxy), 'AGRI.timber_per_ha_proxy'));
  content.add(refRow('catfish/tilapia / kg',  idr(UC.AGRI.catfish_tilapia_per_kg), 'AGRI.catfish_tilapia_per_kg'));
  content.add(refRow('fingerling (each)',     idr(UC.AGRI.fingerling_each),    'AGRI.fingerling_each'));
  content.add(refRow('fishing vessel / GT',   idr(UC.AGRI.vessel_per_gt),      'AGRI.vessel_per_gt'));

  content.add(head('C-3 Other Productive (Industry / Commerce)'));
  content.add(tblHead());
  content.add(refRow('factory / m²',          idr(UC.COMMERCE.factory_per_m2),  'COMMERCE.factory_per_m2'));
  content.add(refRow('shop / m²',             idr(UC.COMMERCE.shop_per_m2),     'COMMERCE.shop_per_m2'));
  content.add(refRow('warehouse / m²',        idr(UC.COMMERCE.warehouse_per_m2),'COMMERCE.warehouse_per_m2'));
  content.add(refRow('hotel / m²',            idr(UC.COMMERCE.hotel_per_m2),    'COMMERCE.hotel_per_m2'));
  content.add(refRow('office / m²',           idr(UC.COMMERCE.office_per_m2),   'COMMERCE.office_per_m2'));
  content.add(refRow('avg shop area',         UC.COMMERCE.shop_avg_m2 + ' m²',   'COMMERCE.shop_avg_m2'));
  content.add(refRow('avg warehouse area',    UC.COMMERCE.warehouse_avg_m2 + ' m²', 'COMMERCE.warehouse_avg_m2'));
  content.add(refRow('avg factory area',      UC.COMMERCE.factory_avg_m2 + ' m²',   'COMMERCE.factory_avg_m2'));
  content.add(refRow('avg hotel area',        UC.COMMERCE.hotel_avg_m2 + ' m²',     'COMMERCE.hotel_avg_m2'));
  content.add(refRow('avg office area',       UC.COMMERCE.office_avg_m2 + ' m²',    'COMMERCE.office_avg_m2'));

  content.add(head('Indirect L-1..L-4 (Jakarta / National)'));
  content.add(tblHead());
  content.add(refRow('L-1 worker / day (Jakarta)',
    idr(UC.INDIRECT.business_per_worker_day_jakarta),
    'INDIRECT.business_per_worker_day_jakarta'));
  content.add(refRow('L-1 worker / day (national)',
    idr(UC.INDIRECT.business_per_worker_day_national),
    'INDIRECT.business_per_worker_day_national'));
  content.add(refRow('L-2 HH / event (Jakarta)',
    idr(UC.INDIRECT.cleaning_materials_jakarta),
    'INDIRECT.cleaning_materials_jakarta'));
  content.add(refRow('L-2 HH / event (national)',
    idr(UC.INDIRECT.cleaning_materials_national),
    'INDIRECT.cleaning_materials_national'));
  content.add(refRow('L-3 meals / day (Jakarta)',
    idr(UC.INDIRECT.substitute_meals_jakarta),
    'INDIRECT.substitute_meals_jakarta'));
  content.add(refRow('L-3 meals / day (national)',
    idr(UC.INDIRECT.substitute_meals_national),
    'INDIRECT.substitute_meals_national'));
  content.add(refRow('L-4 labor / day (Jakarta)',
    idr(UC.INDIRECT.cleaning_labor_jakarta),
    'INDIRECT.cleaning_labor_jakarta'));
  content.add(refRow('L-4 labor / day (national)',
    idr(UC.INDIRECT.cleaning_labor_national),
    'INDIRECT.cleaning_labor_national'));
  content.add(refRow('default business days',
    String(UC.INDIRECT.default_business_days),
    'INDIRECT.default_business_days'));
  content.add(refRow('default meals days',
    String(UC.INDIRECT.default_meals_days),
    'INDIRECT.default_meals_days'));
  content.add(refRow('default labor days',
    String(UC.INDIRECT.default_labor_days),
    'INDIRECT.default_labor_days'));

  content.add(head('RF-LULC class → cost (drives land_cover_ha damage classes)'));
  content.add(note('In-house Random-Forest LULC (BNPB/lulc_idn_2025_30m, 30 m). ' +
    'Unpriced classes (3 Sand · 5 City · 6 Water) carry no land-cover damage.'));
  content.add(tblHead());
  var LULC_LABEL = {1: 'Rice (Sawah)', 2: 'Corn (Tegalan)',
                    4: 'Forest (Hutan)', 7: 'Palm oil (Kebun)'};
  Object.keys(UC.LULC_TO_COST).forEach(function(id) {
    var e = UC.LULC_TO_COST[id];
    var bg = zbg();
    content.add(ui.Panel([
      ui.Label('class ' + id + ' — ' + (LULC_LABEL[id] || e.key),
        {fontSize: '11px', color: COL.inkSoft, width: '240px',
         margin: '0 6px 0 0', backgroundColor: bg}),
      ui.Label('[' + e.sendai + ']  ' + idr(e.cost_per_ha) + ' / ha',
        {fontSize: '11px', color: COL.ink, width: '170px',
         margin: '0 6px 0 0', backgroundColor: bg}),
      ui.Label(id === '1' ? 'rice price × yield [G]' :
               id === '2' ? 'corn production value [G]' :
               id === '4' ? 'KLHK critical-land rehab, 14-17 juta/ha mid-point' :
                            'Perkebunan — Jitupasna past requests, natl avg [E], no prov ratio',
        {fontSize: '10px', color: COL.muted, fontStyle: 'italic',
         backgroundColor: bg}),
    ], ui.Panel.Layout.flow('horizontal'),
       {margin: '0', padding: '1px 4px', backgroundColor: bg}));
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
  var items = ['(All curves)'].concat(names);
  var curveSel = ui.Select({items: items, value: 'residential'});
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

  function makeChart(curveName) {
    chartHolder.clear();
    tableHolder.clear();

    if (curveName === '(All curves)') {
      var xs = [];
      for (var d = 0; d <= 6.0001; d += 0.25) xs.push(+d.toFixed(2));
      var feats = xs.map(function(d) {
        var p = {depth: d};
        names.forEach(function(n) { p[n] = DDF.evaluate(n, d); });
        return ee.Feature(null, p);
      });
      var fc = ee.FeatureCollection(feats);
      var chart = ui.Chart.feature.byFeature(fc, 'depth', names)
        .setChartType('LineChart')
        .setOptions({
          title: 'All DDF curves (depth → damage ratio)',
          titleTextStyle: {color: COL.inkSoft, fontSize: 12, bold: true},
          hAxis: {title: 'Depth (m)', minValue: 0,
                  titleTextStyle: {color: COL.muted, italic: false},
                  textStyle: {color: COL.muted, fontSize: 10},
                  gridlines: {color: COL.grid},
                  baselineColor: COL.grid},
          vAxis: {title: 'Damage ratio',
                  viewWindow: {min: 0, max: 1.0},
                  ticks: [0, 0.25, 0.5, 0.75, 1.0],
                  format: 'percent',
                  titleTextStyle: {color: COL.muted, italic: false},
                  textStyle: {color: COL.muted, fontSize: 10},
                  gridlines: {color: COL.grid},
                  baselineColor: COL.grid},
          height: 380,
          lineWidth: 2,
          pointSize: 2,
          colors: CAT,
          backgroundColor: COL.surface,
          legend: {position: 'right',
                   textStyle: {color: COL.inkSoft, fontSize: 11}},
        });
      chartHolder.add(chart);

      tableHolder.add(ui.Label('Damage ratios at common depths (%):',
        {fontWeight: 'bold', fontSize: '12px', color: '333',
         margin: '8px 0 4px 0'}));
      var depthGrid = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0];
      _z = 0;
      var hdrCells = [ui.Label('Curve', {fontSize: '11px',
        width: '170px', fontWeight: 'bold', color: COL.inkSoft,
        backgroundColor: COL.page})];
      depthGrid.forEach(function(d) {
        hdrCells.push(ui.Label(d + ' m', {fontSize: '11px',
          width: '60px', fontWeight: 'bold', color: COL.inkSoft,
          backgroundColor: COL.page}));
      });
      tableHolder.add(ui.Panel(hdrCells,
        ui.Panel.Layout.flow('horizontal'),
        {margin: '0', padding: '2px 4px',
         backgroundColor: COL.page, border: '1px solid ' + COL.grid}));
      names.forEach(function(n) {
        var bg = zbg();
        var cells = [ui.Label(n, {fontSize: '11px',
          width: '170px', color: '#333333', backgroundColor: bg})];
        depthGrid.forEach(function(d) {
          var r = DDF.evaluate(n, d);
          cells.push(ui.Label(pct(r),
            {fontSize: '11px', width: '60px',
             color: r > 0.5 ? COL.critical : '#333333',
             fontWeight: r > 0.5 ? 'bold' : 'normal',
             backgroundColor: bg}));
        });
        tableHolder.add(ui.Panel(cells,
          ui.Panel.Layout.flow('horizontal'),
          {margin: '0', padding: '1px 4px', backgroundColor: bg}));
      });
    } else {
      var c = DDF.CURVES[curveName];
      var sFeats = c.depths_m.map(function(d, i) {
        return ee.Feature(null, {depth: d, ratio: c.ratios[i]});
      });
      var fc = ee.FeatureCollection(sFeats);
      var chart = ui.Chart.feature.byFeature(fc, 'depth', ['ratio'])
        .setChartType('LineChart')
        .setOptions({
          title: curveName + ' DDF',
          titleTextStyle: {color: COL.inkSoft, fontSize: 12, bold: true},
          hAxis: {title: 'Depth (m)', minValue: 0,
                  titleTextStyle: {color: COL.muted, italic: false},
                  textStyle: {color: COL.muted, fontSize: 10},
                  gridlines: {color: COL.grid},
                  baselineColor: COL.grid},
          vAxis: {title: 'Damage ratio',
                  viewWindow: {min: 0, max: 1.0},
                  ticks: [0, 0.25, 0.5, 0.75, 1.0],
                  format: 'percent',
                  titleTextStyle: {color: COL.muted, italic: false},
                  textStyle: {color: COL.muted, fontSize: 10},
                  gridlines: {color: COL.grid},
                  baselineColor: COL.grid},
          height: 320,
          colors: [COL.blue],
          backgroundColor: COL.surface,
          lineWidth: 3,
          pointSize: 5,
          legend: {position: 'none'},
        });
      chartHolder.add(chart);

      // Tables with explanatory notes
      tableHolder.add(ui.Label(
        'Control points (defined by JRC paper):',
        {fontWeight: 'bold', fontSize: '12px', color: '333',
         margin: '8px 0 2px 0'}));
      tableHolder.add(ui.Label(
        'These are the depth / damage-ratio anchor values from ' +
        'Huizinga et al. 2017 (Asian region).',
        {fontSize: '10px', color: '666', fontStyle: 'italic',
         margin: '0 0 4px 0'}));
      _z = 0;
      tableHolder.add(ui.Panel([
        ui.Label('Depth (m)',    {fontSize: '11px', width: '110px',
                                  fontWeight: 'bold', color: COL.inkSoft,
                                  backgroundColor: COL.page}),
        ui.Label('Damage ratio', {fontSize: '11px', width: '120px',
                                  fontWeight: 'bold', color: COL.inkSoft,
                                  backgroundColor: COL.page}),
      ], ui.Panel.Layout.flow('horizontal'),
         {margin: '0', padding: '2px 4px',
          backgroundColor: COL.page, border: '1px solid ' + COL.grid}));
      for (var i = 0; i < c.depths_m.length; i++) {
        var bg = zbg();
        tableHolder.add(ui.Panel([
          ui.Label(c.depths_m[i].toFixed(2),
            {fontSize: '11px', width: '110px', color: COL.ink,
             backgroundColor: bg}),
          ui.Label(pct(c.ratios[i]),
            {fontSize: '11px', width: '120px',
             color: COL.critical, fontWeight: 'bold',
             backgroundColor: bg}),
        ], ui.Panel.Layout.flow('horizontal'),
           {margin: '0', padding: '1px 4px', backgroundColor: bg}));
      }

    }
  }

  curveSel.onChange(makeChart);
  makeChart('residential');

  // Aliases section — with explanatory note
  content.add(head('Aliases — convenience names'));
  content.add(ui.Label(
    'Alternate keys mapping Indonesian / Jitupasna / DIBI vocabulary to ' +
    'the curve names above. Lets call sites use familiar terms: ' +
    'DDF.evaluate("sawah", 1.0) instead of DDF.evaluate("rice_paddy", 1.0). ' +
    'Identical result either way.',
    {fontSize: '10px', color: '666', fontStyle: 'italic',
     margin: '0 0 6px 0'}));
  content.add(ui.Panel([
    ui.Label('Alias',     {fontSize: '11px', width: '240px',
                           fontWeight: 'bold', color: COL.inkSoft,
                           backgroundColor: COL.page}),
    ui.Label('Resolves to', {fontSize: '11px', fontWeight: 'bold',
                             color: COL.inkSoft, backgroundColor: COL.page}),
  ], ui.Panel.Layout.flow('horizontal'),
     {margin: '0 0 2px 0', padding: '2px 4px',
      backgroundColor: COL.page, border: '1px solid ' + COL.grid}));
  Object.keys(DDF.ALIASES).forEach(function(a) {
    content.add(row(a, '→ ' + DDF.ALIASES[a]));
  });
}


// ====================================================================
// 3) Exposure datasets — BNPB GIS Assets + GEE Public catalog layers
//
// Each row: layer name, Asset path / GEE catalog ID, feature/pixel
// metadata (count or resolution), and which DIBI / Jitupasna column
// the data feeds into.
// ====================================================================
function renderExposure() {
  content.add(head('Exposure & reference datasets'));
  content.add(note('GIS layers used to count submerged assets, plus the ' +
    'public catalog rasters used for population, buildings and land cover. ' +
    'Source attribution below points to the canonical producing K/L ' +
    '(ministry/agency) and the BIG Ina-Geoportal where all national ' +
    'geospatial data is aggregated: https://tanahair.indonesia.go.id'));

  // (category, items[]) where items = [name, source, meta, dibi_col, notes]
  var groups = [
    {
      title: 'Admin boundaries — BPS (https://gis.bps.go.id/)',
      items: [
        ['adm1 (Province)',  C.ASSETS.adm1, '34 prov',  'province_id',
          'aggregation key'],
        ['adm2 (Kab/Kota)',  C.ASSETS.adm2, '514 kab/kota', 'city_id',
          'main aggregation unit'],
        ['adm3 (Kecamatan)', C.ASSETS.adm3, '~7,201',   '—',
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
        ['WorldPop IDN',             C.PUBLIC.worldPop,    '100 m, 2020',
          'suffered', 'affected population'],
        ['GHSL POP 2020',            C.PUBLIC.ghslPop,     '100 m',
          '—', 'WorldPop cross-check'],
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

  // Render: each group as a sub-section with 5-column table
  groups.forEach(function(g) {
    content.add(head(g.title));
    content.add(ui.Panel([
      ui.Label('Layer',     {fontSize: '11px', width: '190px',
                             fontWeight: 'bold', color: COL.inkSoft,
                             backgroundColor: COL.page}),
      ui.Label('Count',     {fontSize: '11px', width: '110px',
                             fontWeight: 'bold', color: COL.inkSoft,
                             backgroundColor: COL.page}),
      ui.Label('Feeds DIBI column', {fontSize: '11px', width: '220px',
                             fontWeight: 'bold', color: COL.inkSoft,
                             backgroundColor: COL.page}),
      ui.Label('Notes',     {fontSize: '11px', fontWeight: 'bold',
                             color: COL.inkSoft, backgroundColor: COL.page}),
    ], ui.Panel.Layout.flow('horizontal'),
       {margin: '2px 0', padding: '2px 4px',
        backgroundColor: COL.page, border: '1px solid ' + COL.grid}));
    g.items.forEach(function(it) {
      var name = it[0], src = it[1], meta = it[2], col = it[3], notes = it[4];
      // Hide private GEE Asset paths (e.g. "projects/<user>/assets/BNPB/...")
      // — those are personal storage locations, NOT data-source
      // attribution. The group title
      // already shows the canonical K/L producer URL.
      // Public catalog IDs (COPERNICUS/, ESA/, JRC/, WWF/, GOOGLE/, etc.)
      // are preserved as they are valid open identifiers.
      var isPrivateAsset = (typeof src === 'string') &&
        (src.indexOf('projects/') === 0 ||
         src.indexOf('users/')    === 0 ||
         src.indexOf('BNPB/')     === 0);
      var subLabel = isPrivateAsset ? '' : src;

      // One zebra color per row — the nested nameCell panel AND every label
      // must carry the SAME background, or they render as white boxes on
      // the striped row.
      var bg = zbg();
      var nameWidgets = [
        ui.Label(name, {fontSize: '11px', color: COL.ink, margin: '0',
                        fontWeight: 'bold', backgroundColor: bg})];
      if (subLabel) {
        nameWidgets.push(ui.Label(subLabel,
          {fontSize: '9px', color: COL.muted, margin: '0',
           fontStyle: 'italic', backgroundColor: bg}));
      }
      var nameCell = ui.Panel(nameWidgets, ui.Panel.Layout.flow('vertical'),
        {margin: '0 6px 0 0', width: '190px', backgroundColor: bg});
      content.add(ui.Panel([
        nameCell,
        ui.Label(meta,  {fontSize: '11px', width: '110px', color: COL.ink,
                         backgroundColor: bg}),
        ui.Label(col,   {fontSize: '11px', width: '220px',
                         color: col === '—' ? COL.muted : COL.critical,
                         fontWeight: col === '—' ? 'normal' : 'bold',
                         backgroundColor: bg}),
        ui.Label(notes, {fontSize: '11px', color: COL.inkSoft,
                         backgroundColor: bg}),
      ], ui.Panel.Layout.flow('horizontal'),
         {margin: '1px 0', padding: '1px 4px', backgroundColor: bg}));
    });
  });

  // Coverage summary
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
}


// ====================================================================
// 5) PROVINCE_RATIO — BPS Indeks Kemahalan Konstruksi 2025
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

  // sort by ratio ascending (cheapest first)
  var codes = Object.keys(UC.PROVINCE_RATIO).sort(function(a, b) {
    return UC.PROVINCE_RATIO[a] - UC.PROVINCE_RATIO[b];
  });

  // Chart: every province at a glance. Bar color mirrors the table's text
  // colors — red above ×1.30, green below ×0.85, blue otherwise.
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
      hAxis: {minValue: 0,
              textStyle: {color: COL.muted, fontSize: 10},
              gridlines: {color: COL.grid},
              baselineColor: COL.grid},
      vAxis: {textStyle: {color: COL.inkSoft, fontSize: 10}},
      chartArea: {left: 170, top: 6, right: 24, height: '92%'},
    }));

  _z = 0;
  content.add(ui.Panel([
    ui.Label('Code',    {fontSize: '11px', width: '48px', fontWeight: 'bold',
                         color: COL.inkSoft, backgroundColor: COL.page}),
    ui.Label('Province',{fontSize: '11px', width: '240px', fontWeight: 'bold',
                         color: COL.inkSoft, backgroundColor: COL.page}),
    ui.Label('Ratio × DKI', {fontSize: '11px', width: '100px', fontWeight: 'bold',
                             color: COL.inkSoft, backgroundColor: COL.page}),
    ui.Label('vs Aceh (0.85)', {fontSize: '11px', width: '120px', fontWeight: 'bold',
                                color: COL.inkSoft, backgroundColor: COL.page}),
  ], ui.Panel.Layout.flow('horizontal'),
     {margin: '4px 0 2px 0', padding: '2px 4px',
      backgroundColor: COL.page, border: '1px solid ' + COL.grid}));
  codes.forEach(function(code) {
    var v = UC.PROVINCE_RATIO[code];
    var name = PROV_NAME[code] || ('(code ' + code + ')');
    var color = v > 1.30 ? COL.critical : (v < 0.85 ? COL.good : COL.ink);
    var bold  = v > 1.20 || v < 0.85;
    var vsAceh = (v / 0.846);
    var bg = zbg();
    content.add(ui.Panel([
      ui.Label(code, {fontSize: '11px', width: '48px', color: COL.inkSoft,
                      backgroundColor: bg}),
      ui.Label(name, {fontSize: '11px', width: '240px', color: '#333333',
                      backgroundColor: bg}),
      ui.Label('× ' + v.toFixed(3), {fontSize: '11px', width: '100px',
        color: color, fontWeight: bold ? 'bold' : 'normal',
        backgroundColor: bg}),
      ui.Label('× ' + vsAceh.toFixed(2), {fontSize: '11px', width: '120px',
        color: COL.inkSoft, backgroundColor: bg}),
    ], ui.Panel.Layout.flow('horizontal'),
       {margin: '0', padding: '1px 4px', backgroundColor: bg}));
  });

  content.add(head('Coverage'));
  content.add(row('total provinces',   String(codes.length)));
  content.add(row('cheapest',          'SULAWESI BARAT (× 0.785)'));
  content.add(row('most expensive',    'PAPUA PEGUNUNGAN (× 2.109)'));
  content.add(row('baseline',          'DKI JAKARTA (× 1.000)'));
  content.add(row('data source',       'BPS IKK 2025 (dataset_inventory.xlsx / Ratio for Construction)'));
}


// ====================================================================
// 6) CROPS & FISH per m² (from Cost sheet Column G / Crop and vege / Fish)
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
      hAxis: {minValue: 0, format: 'short',
              textStyle: {color: COL.muted, fontSize: 10},
              gridlines: {color: COL.grid},
              baselineColor: COL.grid},
      vAxis: {textStyle: {color: COL.inkSoft, fontSize: 10}},
      chartArea: {left: 140, top: 6, right: 24, height: '90%'},
    }));

  _z = 0;
  content.add(ui.Panel([
    ui.Label('Crop',     {fontSize: '11px', width: '160px', fontWeight: 'bold',
                          color: COL.inkSoft, backgroundColor: COL.page}),
    ui.Label('IDR/m²',   {fontSize: '11px', width: '100px', fontWeight: 'bold',
                          color: COL.inkSoft, backgroundColor: COL.page}),
    ui.Label('IDR/ha',   {fontSize: '11px', width: '160px', fontWeight: 'bold',
                          color: COL.inkSoft, backgroundColor: COL.page}),
  ], ui.Panel.Layout.flow('horizontal'),
     {margin: '4px 0 2px 0', padding: '2px 4px',
      backgroundColor: COL.page, border: '1px solid ' + COL.grid}));
  cropKeys.forEach(function(k) {
    var v = UC.CROPS_PER_M2[k];
    var color = v > 30000 ? COL.critical : COL.ink;
    var bg = zbg();
    content.add(ui.Panel([
      ui.Label(k, {fontSize: '11px', width: '160px', color: '#333333',
                   backgroundColor: bg}),
      ui.Label(v.toLocaleString(), {fontSize: '11px', width: '100px', color: color,
        fontWeight: v > 30000 ? 'bold' : 'normal', backgroundColor: bg}),
      ui.Label(idr(v * 10000) + ' / ha', {fontSize: '11px', width: '160px',
        color: COL.inkSoft, backgroundColor: bg}),
    ], ui.Panel.Layout.flow('horizontal'),
       {margin: '0', padding: '1px 4px', backgroundColor: bg}));
  });

  content.add(head('FISH_PER_M2 — aquaculture per m² (IDR/m²)'));
  content.add(note('= density (kg/m²) × market price (IDR/kg). ' +
    '⚠ marks entries flagged "Too Cheap?" in the source spreadsheet.'));

  _z = 0;
  content.add(ui.Panel([
    ui.Label('Type',       {fontSize: '11px', width: '160px', fontWeight: 'bold',
                            color: COL.inkSoft, backgroundColor: COL.page}),
    ui.Label('IDR/m²',     {fontSize: '11px', width: '120px', fontWeight: 'bold',
                            color: COL.inkSoft, backgroundColor: COL.page}),
    ui.Label('IDR/ha',     {fontSize: '11px', width: '160px', fontWeight: 'bold',
                            color: COL.inkSoft, backgroundColor: COL.page}),
  ], ui.Panel.Layout.flow('horizontal'),
     {margin: '4px 0 2px 0', padding: '2px 4px',
      backgroundColor: COL.page, border: '1px solid ' + COL.grid}));

  var flagged = {seaweed: true, milkfish: true, tiger_shrimp: true};
  Object.keys(UC.FISH_PER_M2).forEach(function(k) {
    var v = UC.FISH_PER_M2[k];
    var isFlagged = flagged[k];
    var bg = zbg();
    content.add(ui.Panel([
      ui.Label((isFlagged ? '⚠ ' : '') + k,
        {fontSize: '11px', width: '160px',
         color: isFlagged ? '#bf6f00' : '#333333', backgroundColor: bg}),
      ui.Label(v.toLocaleString(), {fontSize: '11px', width: '120px',
        color: COL.ink, backgroundColor: bg}),
      ui.Label(idr(v * 10000) + ' / ha',
        {fontSize: '11px', width: '160px', color: COL.inkSoft,
         backgroundColor: bg}),
    ], ui.Panel.Layout.flow('horizontal'),
       {margin: '0', padding: '1px 4px', backgroundColor: bg}));
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
// 6) Sanity test — worked example with the FULL pipeline formula
//     damage = qty × unit × DDF(depth) × province_ratio
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
      vAxis: {title: 'Rp million', minValue: 0,
              titleTextStyle: {color: COL.muted, italic: false},
              textStyle: {color: COL.muted, fontSize: 10},
              gridlines: {color: COL.grid},
              baselineColor: COL.grid},
      chartArea: {left: 70, top: 10, right: 16, height: '75%'},
    }));
  DEPTH_STEPS.forEach(function(d) {
    var r = DDF.evaluate('residential', d);
    content.add(row('depth ' + d.toFixed(2) + ' m',
      pct(r) + '   →  ' + idr(base * r)));
  });
}


render(SECTIONS[0]);
