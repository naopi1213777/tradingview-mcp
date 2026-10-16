/**
 * Core data access logic.
 */
import { evaluate, evaluateAsync, KNOWN_PATHS, safeString } from '../connection.js';
import { waitForChartReady } from '../wait.js';

const MAX_OHLCV_BARS = 500;
const MAX_TRADES = 20;

// Round to 8 dp — enough to kill float noise (29899.999999997 → 29900) without
// destroying precision on forex/crypto prices. The old 2-dp rounding flattened
// sub-cent levels to 0.00 (issue #77).
const roundPrice = (v) => (v == null ? null : Math.round(v * 1e8) / 1e8);
const CHART_API = KNOWN_PATHS.chartApi;
const BARS_PATH = KNOWN_PATHS.mainSeriesBars;

// Serializes getQuote() calls that mutate chart symbol so concurrent callers
// can't race over the shared chart state. JS is single-threaded but our
// awaits interleave; without this every parallel quote_get(symbol) would
// read whichever symbol the chart happened to be on at evaluate() time.
let _quoteLock = Promise.resolve();

// Shared page-context JS: locate the strategy data source. Strategies are
// identified by metaInfo().isTVScriptStrategy / is_strategy — NOT by
// is_price_study===false (that was the #48/#173/#181 bug: strategies actually
// have is_price_study===true, so the old check excluded every one). Falls
// back to any source exposing reportData/ordersData.
const FIND_STRATEGY_JS = `
  function _reportOf(s) {
    try { var rd = s.reportData(); if (rd && typeof rd.value === 'function') rd = rd.value(); return rd; } catch (e) { return null; }
  }
  function findStrategies() {
    var chart = ${CHART_API}._chartWidget;
    var sources = chart.model().model().dataSources();
    var strategies = [];
    for (var i = 0; i < sources.length; i++) {
      var s = sources[i], mi = null;
      try { mi = s.metaInfo ? s.metaInfo() : null; } catch (e) {}
      var isStrat = mi && (mi.isTVScriptStrategy || mi.is_strategy);
      if ((isStrat || typeof s.reportData === 'function') && typeof s.reportData === 'function') {
        strategies.push({ s: s, id: String(s.id()), name: mi ? mi.description : null });
      }
    }
    return strategies;
  }
  function findStrategy() {
    var strategies = findStrategies();
    var matches = requestedStrategyId == null ? strategies : strategies.filter(function(x) { return x.id === requestedStrategyId; });
    if (matches.length > 1) throw new Error('Multiple strategies; provide exact entity_id');
    if (!matches.length) {
      if (requestedStrategyId != null) throw new Error('Selected strategy entity_id not found');
      return null;
    }
    var selected = matches[0];
    return { strat: selected.s, id: selected.id, report: _reportOf(selected.s), name: selected.name, strategy_count: strategies.length };
  }
`;

function strategyJS(entity_id) {
  return `${FIND_STRATEGY_JS}\nvar requestedStrategyId = ${entity_id == null ? 'null' : safeString(entity_id)};`;
}

function buildGraphicsJS(collectionName, mapKey, filter) {
  return `
    (function() {
      var chart = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget;
      var model = chart.model();
      var sources = model.model().dataSources();
      var results = [];
      var filter = ${safeString(filter || '')};
      for (var si = 0; si < sources.length; si++) {
        var s = sources[si];
        if (!s.metaInfo) continue;
        try {
          var meta = s.metaInfo();
          var name = meta.description || meta.shortDescription || '';
          if (!name) continue;
          if (filter && name.indexOf(filter) === -1) continue;
          var g = s._graphics;
          if (!g || !g._primitivesCollection) continue;
          var pc = g._primitivesCollection;
          var items = [];
          try {
            var outer = pc.${collectionName};
            if (outer) {
              var inner = outer.get('${mapKey}');
              if (inner) {
                var coll = inner.get(false);
                if (coll && coll._primitivesDataById && coll._primitivesDataById.size > 0) {
                  coll._primitivesDataById.forEach(function(v, id) { items.push({id: id, raw: v}); });
                }
              }
            }
          } catch(e) {}
          if (items.length === 0 && '${collectionName}' === 'dwgtablecells') {
            try {
              var tcOuter = pc.dwgtablecells;
              if (tcOuter) {
                var tcColl = tcOuter.get('tableCells');
                if (tcColl && tcColl._primitivesDataById && tcColl._primitivesDataById.size > 0) {
                  tcColl._primitivesDataById.forEach(function(v, id) { items.push({id: id, raw: v}); });
                }
              }
            } catch(e) {}
          }
          if (items.length > 0) results.push({name: name, count: items.length, items: items});
        } catch(e) {}
      }
      return results;
    })()
  `;
}

export async function getOhlcv({ count, summary } = {}) {
  const limit = Math.min(count || 100, MAX_OHLCV_BARS);
  let data;
  try {
    data = await evaluate(`
      (function() {
        var bars = ${BARS_PATH};
        if (!bars || typeof bars.lastIndex !== 'function') return null;
        var result = [];
        var end = bars.lastIndex();
        var start = Math.max(bars.firstIndex(), end - ${limit} + 1);
        for (var i = start; i <= end; i++) {
          var v = bars.valueAt(i);
          if (v) result.push({time: v[0], open: v[1], high: v[2], low: v[3], close: v[4], volume: v[5] || 0});
        }
        return {bars: result, total_bars: bars.size(), source: 'direct_bars'};
      })()
    `);
  } catch { data = null; }

  if (!data || !data.bars || data.bars.length === 0) {
    throw new Error('Could not extract OHLCV data. The chart may still be loading.');
  }

  if (summary) {
    const bars = data.bars;
    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);
    const volumes = bars.map(b => b.volume);
    const first = bars[0];
    const last = bars[bars.length - 1];
    return {
      success: true, bar_count: bars.length,
      period: { from: first.time, to: last.time },
      open: first.open, close: last.close,
      high: Math.max(...highs), low: Math.min(...lows),
      range: roundPrice(Math.max(...highs) - Math.min(...lows)),
      change: roundPrice(last.close - first.open),
      change_pct: Math.round(((last.close - first.open) / first.open) * 10000) / 100 + '%',
      avg_volume: Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length),
      last_5_bars: bars.slice(-5),
    };
  }

  return { success: true, bar_count: data.bars.length, total_available: data.total_bars, source: data.source, bars: data.bars };
}

export async function getIndicator({ entity_id }) {
  const data = await evaluate(`
    (function() {
      var api = ${CHART_API};
      var study = api.getStudyById(${safeString(entity_id)});
      if (!study) return { error: 'Study not found: ' + ${safeString(entity_id)} };
      var result = { name: null, inputs: null, visible: null };
      try { result.visible = study.isVisible(); } catch(e) {}
      try { result.inputs = study.getInputValues(); } catch(e) { result.inputs_error = e.message; }
      return result;
    })()
  `);

  if (data?.error) throw new Error(data.error);

  let inputs = data?.inputs;
  if (Array.isArray(inputs)) {
    inputs = inputs.filter(inp => {
      if (inp.id === 'text' && typeof inp.value === 'string' && inp.value.length > 200) return false;
      if (typeof inp.value === 'string' && inp.value.length > 500) return false;
      return true;
    });
  }
  return { success: true, entity_id, visible: data?.visible, inputs };
}

// Reading has no preparation effects by default. Explicit preparation selects
// one exact strategy before touching panel/visibility, and reports those effects.
async function ensureStrategyTesterReady({ entity_id, prepare = false } = {}, evalIn = evaluate) {
  const selected = await evalIn(`(function() {
    ${strategyJS(entity_id)}
    var f = findStrategy();
    return f ? { id: f.id, name: f.name } : null;
  })()`);
  if (!selected) return { status: 'no-strategy', strategy_id: null, effects: { panel_requested: false, unhidden: false } };
  const effects = prepare ? await evalIn(`(function() {
    ${strategyJS(selected.id)}
    var f = findStrategy();
    var changed = false, panel = false;
    var bwb = window.TradingView && window.TradingView.bottomWidgetBar;
    if (bwb && typeof bwb.showWidget === 'function') { bwb.showWidget('backtesting'); panel = true; }
    if (f.strat.properties().visible.value() === false) {
      f.strat.properties().visible.setValue(true);
      changed = true;
    }
    return { panel_requested: panel, unhidden: changed };
  })()`) : { panel_requested: false, unhidden: false };
  const deadline = Date.now() + (prepare ? 6000 : 0);
  let ready;
  do {
    ready = await evalIn(`(function() {
      ${strategyJS(selected.id)}
      var f = findStrategy();
      return !!(f && f.report && f.report.performance);
    })()`);
    if (ready || !prepare) break;
    await new Promise(r => setTimeout(r, 500));
  } while (Date.now() < deadline);
  return { status: ready ? 'ready' : 'not-ready', strategy_id: selected.id, effects };
}

export async function getStrategyResults({ entity_id, prepare = false, _deps } = {}) {
  const evalIn = _deps?.evaluate || evaluate;
  const ready = await ensureStrategyTesterReady({ entity_id, prepare }, evalIn);
  if (ready.status === 'no-strategy') return { success: false, error: 'No strategy on chart', preparation: ready };
  const results = await evalIn(`
    (function() {
      ${strategyJS(ready.strategy_id)}
      try {
        var found = findStrategy();
        if (!found) return {metrics: {}, source: 'internal_api', error: 'No strategy found on chart. Add a strategy first (e.g. indicator_add with a "... Strategy" script).'};
        var rd = found.report;
        if (!rd || !rd.performance) return {metrics: {}, source: 'internal_api', error: 'Strategy report not computed yet. Retry in a few seconds; if it persists, check the Strategy Tester panel is open (ui_open_panel strategy-tester) and the strategy is not hidden on the chart.'};
        var perf = rd.performance;
        var all = perf.all || {};
        // Headline metrics, named to match the Strategy Tester "Key stats".
        var metrics = {
          net_profit: all.netProfit,
          net_profit_percent: all.netProfitPercent,
          gross_profit: all.grossProfit,
          gross_loss: all.grossLoss,
          profit_factor: all.profitFactor,
          max_drawdown: perf.maxStrategyDrawDown,
          max_drawdown_percent: perf.maxStrategyDrawDownPercent,
          total_trades: Number.isFinite(all.numberOfWiningTrades) && Number.isFinite(all.numberOfLosingTrades) ? all.numberOfWiningTrades + all.numberOfLosingTrades : undefined,
          winning_trades: all.numberOfWiningTrades,
          losing_trades: all.numberOfLosingTrades,
          percent_profitable: all.percentProfitable,
          avg_trade: all.avgTrade,
          largest_win: all.largestWinTrade,
          largest_loss: all.largestLosTrade,
          commission_paid: all.commissionPaid,
          sharpe_ratio: perf.sharpeRatio,
          sortino_ratio: perf.sortinoRatio,
          buy_hold_return: perf.buyHoldReturn,
          open_pl: perf.openPL
        };
        var clean = {};
        for (var k in metrics) { if (metrics[k] !== null && metrics[k] !== undefined) clean[k] = metrics[k]; }
        var currency = rd.currency || null;
        return {metrics: clean, currency: currency, strategy: found.name, source: 'internal_api'};
      } catch(e) { return {metrics: {}, source: 'internal_api', error: e.message}; }
    })()
  `);
  return {
    success: Object.keys(results?.metrics || {}).length > 0,
    metric_count: Object.keys(results?.metrics || {}).length,
    strategy: results?.strategy, currency: results?.currency, source: results?.source,
    metrics: results?.metrics || {},
    strategy_id: ready.strategy_id, preparation: ready,

    error: results?.error,
  };
}

export async function getTrades({ max_trades, entity_id, prepare = false, _deps } = {}) {
  if (max_trades != null && (!Number.isInteger(max_trades) || max_trades < 1)) throw new Error('max_trades must be a positive integer');
  const limit = Math.min(max_trades ?? 20, MAX_TRADES);
  const evalIn = _deps?.evaluate || evaluate;
  const ready = await ensureStrategyTesterReady({ entity_id, prepare }, evalIn);
  if (ready.status === 'no-strategy') return { success: false, error: 'No strategy on chart', preparation: ready };
  const trades = await evalIn(`
    (function() {
      ${strategyJS(ready.strategy_id)}
      try {
        var found = findStrategy();
        if (!found) return {trades: [], source: 'internal_api', error: 'No strategy found on chart.'};
        var strat = found.strat;
        var orders = strat.ordersData(); if (orders && typeof orders.value === 'function') orders = orders.value();
        if (!orders || !Array.isArray(orders)) return {trades: [], source: 'internal_api', total_orders: 0, error: 'Strategy orders not computed yet. Open the Strategy Tester panel (ui_open_panel strategy-tester) and retry.'};
        var total = orders.length;
        // Return the most RECENT orders (tail) — that's what a trader wants to see.
        var start = Math.max(0, total - ${limit});
        var result = [];
        for (var t = start; t < total; t++) {
          var o = orders[t];
          if (typeof o === 'object' && o !== null) {
            // Map TradingView's terse order keys to readable names.
            result.push({
              id: o.id,
              type: o.tp,
              side: o.b ? 'buy' : 'sell',
              entry: o.e,
              price: o.p,
              qty: o.q,
              time_index: o.tm
            });
          }
        }
        return {trades: result, total_orders: total, source: 'internal_api'};
      } catch(e) { return {trades: [], source: 'internal_api', error: e.message}; }
    })()
  `);
  return {
    success: (trades?.trades?.length || 0) > 0,
    trade_count: trades?.trades?.length || 0, total_orders: trades?.total_orders ?? null,
    source: trades?.source, trades: trades?.trades || [],
    strategy_id: ready.strategy_id, preparation: ready,

    error: trades?.error,
  };
}

export async function getEquity({ entity_id, prepare = false, _deps } = {}) {
  const evalIn = _deps?.evaluate || evaluate;
  const ready = await ensureStrategyTesterReady({ entity_id, prepare }, evalIn);
  if (ready.status === 'no-strategy') return { success: false, error: 'No strategy on chart', preparation: ready };
  const equity = await evalIn(`
    (function() {
      ${strategyJS(ready.strategy_id)}
      try {
        var found = findStrategy();
        if (!found) return {data: [], source: 'internal_api', error: 'No strategy found on chart.'};
        var rd = found.report;
        if (!rd) return {data: [], source: 'internal_api', error: 'Strategy report not computed yet. Open the Strategy Tester panel and retry.'};
        // buyHold is the per-bar account curve; the equity curve is built from
        // filledOrders' cumulative P&L in reportData.
        var curve = rd.equity || rd.equityChart || null;
        if (Array.isArray(curve)) return {data: curve, source: 'internal_api'};
        if (Array.isArray(rd.buyHold)) {
          return {data: [], buy_hold_points: rd.buyHold.length, source: 'internal_api',
                  note: 'Per-bar equity curve not exposed directly; buyHold baseline has ' + rd.buyHold.length + ' points. Use data_get_strategy_results for summary P&L.'};
        }
        return {data: [], source: 'internal_api', note: 'Equity curve not available via API; use data_get_strategy_results.'};
      } catch(e) { return {data: [], source: 'internal_api', error: e.message}; }
    })()
  `);
  return {
    success: (equity?.data?.length || 0) > 0,
    data_points: equity?.data?.length || 0, source: equity?.source, data: equity?.data || [],
    buy_hold_points: equity?.buy_hold_points, note: equity?.note,
    strategy_id: ready.strategy_id, preparation: ready,

    error: equity?.error,
  };
}

export async function getQuote({ symbol } = {}) {
  // Serialize: chained on _quoteLock so parallel callers run one after another.
  // Catch on the lock chain prevents a single failure from poisoning the chain.
  const run = _quoteLock.then(() => _getQuoteInternal({ symbol }));
  _quoteLock = run.then(() => {}, () => {});
  return run;
}

async function _getQuoteInternal({ symbol } = {}) {
  const requested = (symbol || '').toString().trim();
  let originalSymbol = null;
  let needsRestore = false;

  if (requested) {
    try { originalSymbol = await evaluate(`${CHART_API}.symbol()`); } catch (e) {}
    const bare = (s) => (s || '').toString().split(':').pop().toUpperCase();
    if (bare(originalSymbol) !== bare(requested)) {
      needsRestore = true;
      await evaluateAsync(`
        (function() {
          var chart = ${CHART_API};
          return new Promise(function(resolve) {
            chart.setSymbol(${safeString(requested)}, {});
            setTimeout(resolve, 500);
          });
        })()
      `);
      await waitForChartReady(requested);
    }
  }

  try {
    const data = await evaluate(`
      (function() {
        var api = ${CHART_API};
        var sym = '';
        try { sym = api.symbol(); } catch(e) {}
        if (!sym) { try { sym = api.symbolExt().symbol; } catch(e) {} }
        var ext = {};
        try { ext = api.symbolExt() || {}; } catch(e) {}
        var bars = ${BARS_PATH};
        var quote = { symbol: sym };
        if (bars && typeof bars.lastIndex === 'function') {
          var last = bars.valueAt(bars.lastIndex());
          if (last) { quote.time = last[0]; quote.open = last[1]; quote.high = last[2]; quote.low = last[3]; quote.close = last[4]; quote.last = last[4]; quote.volume = last[5] || 0; }
        }
        try {
          var bidEl = document.querySelector('[class*="bid"] [class*="price"], [class*="dom-"] [class*="bid"]');
          var askEl = document.querySelector('[class*="ask"] [class*="price"], [class*="dom-"] [class*="ask"]');
          if (bidEl) quote.bid = parseFloat(bidEl.textContent.replace(/[^0-9.\\-]/g, ''));
          if (askEl) quote.ask = parseFloat(askEl.textContent.replace(/[^0-9.\\-]/g, ''));
        } catch(e) {}
        try {
          var hdr = document.querySelector('[class*="headerRow"] [class*="last-"]');
          if (hdr) { var hdrPrice = parseFloat(hdr.textContent.replace(/[^0-9.\\-]/g, '')); if (!isNaN(hdrPrice)) quote.header_price = hdrPrice; }
        } catch(e) {}
        if (ext.description) quote.description = ext.description;
        if (ext.exchange) quote.exchange = ext.exchange;
        if (ext.type) quote.type = ext.type;
        return quote;
      })()
    `);
    if (!data || (!data.last && !data.close)) throw new Error('Could not retrieve quote. The chart may still be loading.');
    return { success: true, ...data };
  } finally {
    if (needsRestore && originalSymbol) {
      try {
        await evaluateAsync(`
          (function() {
            var chart = ${CHART_API};
            return new Promise(function(resolve) {
              chart.setSymbol(${safeString(originalSymbol)}, {});
              setTimeout(resolve, 500);
            });
          })()
        `);
        await waitForChartReady(originalSymbol);
      } catch (e) {}
    }
  }
}

export async function getDepth() {
  const data = await evaluate(`
    (function() {
      var domPanel = document.querySelector('[class*="depth"]')
        || document.querySelector('[class*="orderBook"]')
        || document.querySelector('[class*="dom-"]')
        || document.querySelector('[class*="DOM"]')
        || document.querySelector('[data-name="dom"]');
      if (!domPanel) return { found: false, error: 'DOM / Depth of Market panel not found.' };
      var bids = [], asks = [];
      var rows = domPanel.querySelectorAll('[class*="row"], tr');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var priceEl = row.querySelector('[class*="price"]');
        var sizeEl = row.querySelector('[class*="size"], [class*="volume"], [class*="qty"]');
        if (!priceEl) continue;
        var price = parseFloat(priceEl.textContent.replace(/[^0-9.\\-]/g, ''));
        var size = sizeEl ? parseFloat(sizeEl.textContent.replace(/[^0-9.\\-]/g, '')) : 0;
        if (isNaN(price)) continue;
        var rowClass = row.className || '';
        var rowHTML = row.innerHTML || '';
        if (/bid|buy/i.test(rowClass) || /bid|buy/i.test(rowHTML)) bids.push({ price, size });
        else if (/ask|sell/i.test(rowClass) || /ask|sell/i.test(rowHTML)) asks.push({ price, size });
        else if (i < rows.length / 2) asks.push({ price, size });
        else bids.push({ price, size });
      }
      if (bids.length === 0 && asks.length === 0) {
        var cells = domPanel.querySelectorAll('[class*="cell"], td');
        var prices = [];
        cells.forEach(function(c) { var val = parseFloat(c.textContent.replace(/[^0-9.\\-]/g, '')); if (!isNaN(val) && val > 0) prices.push(val); });
        if (prices.length > 0) return { found: true, raw_values: prices.slice(0, 50), bids: [], asks: [], note: 'Could not classify bid/ask levels.' };
      }
      bids.sort(function(a, b) { return b.price - a.price; });
      asks.sort(function(a, b) { return a.price - b.price; });
      var spread = null;
      if (asks.length > 0 && bids.length > 0) spread = +(asks[0].price - bids[0].price).toFixed(6);
      return { found: true, bids: bids, asks: asks, spread: spread };
    })()
  `);

  if (!data || !data.found) throw new Error(data?.error || 'DOM panel not found.');
  return { success: true, bid_levels: data.bids?.length || 0, ask_levels: data.asks?.length || 0, spread: data.spread, bids: data.bids || [], asks: data.asks || [], raw_values: data.raw_values, note: data.note };
}

export async function getStudyValues() {
  const data = await evaluate(`
    (function() {
      var chart = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget;
      var model = chart.model();
      var sources = model.model().dataSources();
      var results = [];
      for (var si = 0; si < sources.length; si++) {
        var s = sources[si];
        if (!s.metaInfo) continue;
        try {
          var meta = s.metaInfo();
          var name = meta.description || meta.shortDescription || '';
          if (!name) continue;
          var values = {};
          try {
            var dwv = s.dataWindowView();
            if (dwv) {
              var items = dwv.items();
              if (items) {
                for (var i = 0; i < items.length; i++) {
                  var item = items[i];
                  if (item._value && item._value !== '∅' && item._title) values[item._title] = item._value;
                }
              }
            }
          } catch(e) {}
          // Include id + inputs so multiple instances of the same indicator
          // (e.g. two EMAs with different lengths) are distinguishable (#143).
          var id = null;
          try { id = s.id ? s.id() : null; } catch(e) {}
          var inputs = null;
          try { var ip = s.inputs ? s.inputs() : null; if (ip && Object.keys(ip).length) inputs = ip; } catch(e) {}
          if (Object.keys(values).length > 0) results.push({ id: id, name: name, inputs: inputs, values: values });
        } catch(e) {}
      }
      return results;
    })()
  `);
  return { success: true, study_count: data?.length || 0, studies: data || [] };
}

export async function getPineLines({ study_filter, verbose } = {}) {
  const filter = study_filter || '';
  const raw = await evaluate(buildGraphicsJS('dwglines', 'lines', filter));
  if (!raw || raw.length === 0) return { success: true, study_count: 0, studies: [] };

  const studies = raw.map(s => {
    const hLevels = [];
    const seen = {};
    const allLines = [];
    for (const item of s.items) {
      const v = item.raw;
      const y1 = roundPrice(v.y1);
      const y2 = roundPrice(v.y2);
      if (verbose) allLines.push({ id: item.id, y1, y2, x1: v.x1, x2: v.x2, horizontal: v.y1 === v.y2, style: v.st, width: v.w, color: v.ci });
      if (y1 != null && v.y1 === v.y2 && !seen[y1]) { hLevels.push(y1); seen[y1] = true; }
    }
    hLevels.sort((a, b) => b - a);
    const result = { name: s.name, total_lines: s.count, horizontal_levels: hLevels };
    if (verbose) result.all_lines = allLines;
    return result;
  });
  return { success: true, study_count: studies.length, studies };
}

export async function getPineLabels({ study_filter, max_labels, verbose, _deps } = {}) {
  const filter = study_filter || '';
  const raw = await (_deps?.evaluate || evaluate)(buildGraphicsJS('dwglabels', 'labels', filter));
  if (!raw || raw.length === 0) return { success: true, study_count: 0, studies: [] };

  const limit = max_labels ?? 50;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('max_labels must be a positive integer');
  const studies = raw.map(s => {
    let labels = s.items.map(item => {
      const v = item.raw;
      const text = v.t || '';
      const price = roundPrice(v.y);
      if (verbose) return { id: item.id, text, price, x: v.x, yloc: v.yl, size: v.sz, textColor: v.tci, color: v.ci };
      return { text, price };
    }).filter(l => l.text || l.price != null);
    const eligible = labels.length;
    if (labels.length > limit) labels = labels.slice(-limit);
    return { name: s.name, total_labels: s.count, eligible_labels: eligible, returned_labels: labels.length, showing: labels.length, truncated: eligible > labels.length, max_labels: limit, labels };
  });
  return { success: true, study_count: studies.length, studies };
}

export async function getPineTables({ study_filter, _deps } = {}) {
  const filter = study_filter || '';
  const raw = await (_deps?.evaluate || evaluate)(buildGraphicsJS('dwgtablecells', 'tableCells', filter));
  if (!raw || raw.length === 0) return { success: true, study_count: 0, studies: [] };

  const studies = raw.map(s => {
    const tables = {};
    for (const item of s.items) {
      const v = item.raw;
      const tid = v.tid || 0;
      if (!tables[tid]) tables[tid] = {};
      if (!tables[tid][v.row]) tables[tid][v.row] = {};
      tables[tid][v.row][v.col] = v.t || '';
    }
    const tableList = Object.entries(tables).map(([tid, rows]) => {
      const rowNums = Object.keys(rows).map(Number).sort((a, b) => a - b);
      const formatted = rowNums.map(rn => {
        const cols = rows[rn];
        const colNums = Object.keys(cols).map(Number).sort((a, b) => a - b);
        return colNums.map(cn => cols[cn]).filter(Boolean).join(' | ');
      }).filter(Boolean);
      const cells = rowNums.flatMap(row => Object.keys(rows[row]).map(Number).sort((a, b) => a - b).map(column => ({ row, column, text: rows[row][column] })));
      return { table_id: tid, rows: formatted, cells, extent: { rows: Math.max(...rowNums) + 1, columns: Math.max(...cells.map(c => c.column)) + 1 }, note: 'Cells retain returned empty strings and indices; absent cells, decoration and timeframe identity are not inferred.' };
    });
    return { name: s.name, tables: tableList };
  });
  return { success: true, study_count: studies.length, studies };
}

export async function getPineBoxes({ study_filter, verbose } = {}) {
  const filter = study_filter || '';
  const raw = await evaluate(buildGraphicsJS('dwgboxes', 'boxes', filter));
  if (!raw || raw.length === 0) return { success: true, study_count: 0, studies: [] };

  const studies = raw.map(s => {
    const zones = [];
    const seen = {};
    const allBoxes = [];
    for (const item of s.items) {
      const v = item.raw;
      const high = v.y1 != null && v.y2 != null ? roundPrice(Math.max(v.y1, v.y2)) : null;
      const low = v.y1 != null && v.y2 != null ? roundPrice(Math.min(v.y1, v.y2)) : null;
      if (verbose) allBoxes.push({ id: item.id, high, low, x1: v.x1, x2: v.x2, borderColor: v.c, bgColor: v.bc });
      if (high != null && low != null) { const key = high + ':' + low; if (!seen[key]) { zones.push({ high, low }); seen[key] = true; } }
    }
    zones.sort((a, b) => b.high - a.high);
    const result = { name: s.name, total_boxes: s.count, zones };
    if (verbose) result.all_boxes = allBoxes;
    return result;
  });
  return { success: true, study_count: studies.length, studies };
}
