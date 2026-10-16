// Offline boundary tests: no TradingView account or saved-state operations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { isChartTarget, selectChartTarget, isAppTarget, parsePort } from '../src/targets.js';
import { launch } from '../src/core/health.js';
import { getStrategyResults, getTrades, getPineLabels, getPineTables } from '../src/core/data.js';
const chart = (url, id = 'one') => ({ type: 'page', id, url });
test('parsed target boundary and explicit ambiguity', () => {
  for (const url of ['https://www.tradingview.com/chart/', 'https://tradingview.com/chart/ABC123/']) assert.ok(isChartTarget(chart(url)));
  for (const url of ['https://tradingview.com.evil/chart/', 'https://evil/?tradingview.com/chart/', 'https://tradingview.com@evil/chart/', 'https://user@tradingview.com/chart/', 'http://tradingview.com/chart/', 'https://tradingview.com:444/chart/', 'https://tradingview.com/symbols/', 'file:///tmp/tradingview.com/chart/']) assert.equal(isChartTarget(chart(url)), false, url);
  const targets = [chart('https://tradingview.com/chart/'), chart('https://www.tradingview.com/chart/A/', 'two')];
  assert.throws(() => selectChartTarget(targets), /Multiple/);
  assert.equal(selectChartTarget(targets, 'two').id, 'two');
  assert.throws(() => selectChartTarget([chart('https://evil/chart/')], 'one'), /not an eligible/);
  assert.throws(() => selectChartTarget(targets, 'missing'), /missing/);
  for (const value of [0, -1, 65536, 1.2, '9222x', '', NaN]) assert.throws(() => parsePort(value));
  assert.equal(parsePort('9222'), 9222);
});
test('shell/landing ownership is separate from titles and charts', () => {
  assert.equal(isAppTarget({ ...chart('file:///tmp/window/index.html'), title: 'New tab' }, 'window'), false);
  assert.equal(isAppTarget(chart('https://tradingview.com/chart/'), 'window'), false);
  if (process.platform === 'darwin') {
    assert.ok(isAppTarget(chart('file:///Applications/TradingView.app/Contents/Resources/app.asar/app/window/index.html'), 'window'));
    assert.ok(isAppTarget(chart('file:///Applications/TradingView.app/Contents/Resources/app.asar/app/new-tab/index.html'), 'new-tab'));
  }
});
function launchDeps({ ready = false, running = false, binds = true } = {}) {
  const state = { spawns: [], commands: [] };
  let up = ready;
  return { state, deps: {
    existsSync: () => true, isRunning: () => running,
    execSync: cmd => { state.commands.push(cmd); return ''; }, delay: async () => {},
    probeCdp: async () => up ? JSON.stringify({ Browser: 'Chrome/140', 'User-Agent': 'TradingView/3.4.1' }) : null,
    spawn: (exe, args, options) => { state.spawns.push({ exe, args, options }); up = binds; const c = new EventEmitter(); c.pid = 1; c.unref = () => {}; return c; },
  }};
}
test('launch child environment, parent preservation, no default kill and honest readiness', async () => {
  const previous = process.env.ELECTRON_RUN_AS_NODE;
  process.env.ELECTRON_RUN_AS_NODE = '1';
  try {
    const { deps, state } = launchDeps();
    assert.equal((await launch({ _deps: deps })).success, true);
    assert.equal(process.env.ELECTRON_RUN_AS_NODE, '1');
    assert.equal('ELECTRON_RUN_AS_NODE' in state.spawns[0].options.env, false);
    assert.equal(state.spawns[0].options.env.PATH, process.env.PATH);
    assert.equal(state.commands.length, 0);
    const fail = launchDeps({ binds: false });
    assert.equal((await launch({ _deps: fail.deps })).success, false);
    const reuse = launchDeps({ ready: true });
    assert.equal((await launch({ _deps: reuse.deps })).reused, true);
    assert.equal(reuse.state.spawns.length, 0);
    const conflict = launchDeps({ running: true });
    assert.equal((await launch({ _deps: conflict.deps })).success, false);
    assert.equal(conflict.state.spawns.length, 0);
    await assert.rejects(launch({ port: 0, _deps: deps }), /port/);
  } finally { if (previous == null) delete process.env.ELECTRON_RUN_AS_NODE; else process.env.ELECTRON_RUN_AS_NODE = previous; }
});
function dataContext(count = 1) {
  let panel = 0;
  const strategies = Array.from({ length: count }, (_, i) => {
    let visible = false;
    return { id: () => `s${i}`, metaInfo: () => ({ isTVScriptStrategy: true, description: `Strategy ${i}` }),
      properties: () => ({ visible: { value: () => visible, setValue: v => { visible = v; } } }),
      reportData: () => ({ performance: { all: { netProfit: 12.5 } } }), ordersData: () => null,
    };
  });
  const context = vm.createContext({ window: { TradingViewApi: { _activeChartWidgetWV: { value: () => ({ _chartWidget: { model: () => ({ model: () => ({ dataSources: () => strategies }) }) } }) } }, TradingView: { bottomWidgetBar: { showWidget: () => panel++ } } } });
  return { strategies, panel: () => panel, evaluate: async expr => JSON.parse(JSON.stringify(vm.runInContext(expr, context))) };
}
test('strategy ambiguity has no effects; explicit preparation affects only selected strategy', async () => {
  const d = dataContext(2);
  await assert.rejects(getStrategyResults({ _deps: d }), /Multiple strategies/);
  assert.equal(d.panel(), 0);
  const result = await getStrategyResults({ entity_id: 's1', _deps: d });
  assert.equal(result.strategy_id, 's1'); assert.equal(result.metrics.net_profit, 12.5);
  assert.equal(result.metrics.total_trades, undefined); // unavailable is not zero
  assert.equal(d.panel(), 0);
  await getStrategyResults({ entity_id: 's1', prepare: true, _deps: d });
  assert.equal(d.panel(), 1);
  assert.equal(d.strategies[0].properties().visible.value(), false);
  assert.equal(d.strategies[1].properties().visible.value(), true);
  assert.equal((await getTrades({ entity_id: 's1', _deps: d })).total_orders, null);
});
test('label truncation and table blank coordinates remain explicit', async () => {
  const labels = await getPineLabels({ max_labels: 1, verbose: true, _deps: { evaluate: async () => [{ name: 'S', count: 2, items: [{ id: 'a', raw: { t: 'a', y: 0.00001234, x: 1 } }, { id: 'b', raw: { t: 'b', y: 0.00002345, x: 2 } }] }] } });
  assert.equal(labels.studies[0].truncated, true); assert.equal(labels.studies[0].returned_labels, 1); assert.equal(labels.studies[0].labels[0].price, 0.00002345);
  const table = await getPineTables({ _deps: { evaluate: async () => [{ name: 'S', items: [{ raw: { tid: 7, row: 0, col: 0, t: 'A' } }, { raw: { tid: 7, row: 0, col: 1, t: '' } }, { raw: { tid: 7, row: 0, col: 2, t: 'C' } }] }] } });
  assert.equal(table.studies[0].tables[0].table_id, '7');
  assert.deepEqual(table.studies[0].tables[0].cells, [{ row: 0, column: 0, text: 'A' }, { row: 0, column: 1, text: '' }, { row: 0, column: 2, text: 'C' }]);
});
