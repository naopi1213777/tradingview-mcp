// Offline failure injection through real core, CDP, SDK/MCP and CLI boundaries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getStrategyResults, getTrades, getEquity } from '../src/core/data.js';

function page(mode) {
  let panel = 0, unhidden = 0, calls = 0;
  const strategy = {
    id: () => 'selected', metaInfo: () => ({ isTVScriptStrategy: true, description: 'Selected' }),
    reportData: () => ({ performance: { all: { netProfit: 1 } } }),
    properties: () => ({ visible: { value: () => false, setValue: () => {
      unhidden++; if (mode === 'visibility') throw Error('visibility response failed');
    } } }),
  };
  const context = vm.createContext({ URL, location: { href: 'https://jp.tradingview.com/chart/EXPECTED/' }, window: {
    TradingViewApi: { _activeChartWidgetWV: { value: () => ({ _chartWidget: { model: () => ({ model: () => ({ dataSources: () => [strategy] }) }) } }) } },
    TradingView: { bottomWidgetBar: { showWidget: () => { panel++; if (mode === 'panel') throw Error('panel response failed'); } } },
  } });
  return { panel: () => panel, unhidden: () => unhidden, calls: () => calls, evaluate(expression) {
    if (expression === 'location.href') return context.location.href;
    calls++;
    if ((mode === 'selection' && calls === 1) || (mode === 'poll' && calls === 3) || (mode === 'final' && calls === 4) || (mode === 'readonly-final' && calls === 3)) throw Error('simulated read disconnect');
    const value = vm.runInContext(expression, context);
    if (mode === 'unknown' && calls === 2) throw Error('preparation response lost');
    return JSON.parse(JSON.stringify(value));
  } };
}
function checkFailure(result, mode, state) {
  assert.equal(result.success, false);
  assert.match(result.error, /failed|disconnect|lost/);
  assert.equal(result.strategy_id, mode === 'selection' ? null : 'selected');
  const p = result.preparation;
  assert.equal(p.strategy_id, result.strategy_id);
  assert.equal(p.preparation_attempted, !['selection', 'readonly-final'].includes(mode));
  const expected = {
    selection: [false, false, 'not-requested'], 'readonly-final': [false, false, 'not-requested'],
    unknown: [null, null, 'unknown'], panel: [null, false, 'unknown'],
    visibility: [true, null, 'unknown'], poll: [true, true, 'confirmed'], final: [true, true, 'confirmed'],
  }[mode];
  assert.deepEqual([p.effects.panel_requested, p.effects.unhidden, p.effects.status], expected);
  assert.equal(state.panel(), ['selection', 'readonly-final'].includes(mode) ? 0 : 1);
  assert.equal(state.unhidden(), ['selection', 'readonly-final', 'panel'].includes(mode) ? 0 : 1);
  assert.equal(state.calls(), { selection: 1, unknown: 2, panel: 2, visibility: 2, poll: 3, final: 4, 'readonly-final': 3 }[mode]); // no retry/rollback
}
for (const read of [getStrategyResults, getTrades, getEquity]) {
  test(`${read.name} preserves selected identity and confirmed/unknown effects on failures`, async () => {
    for (const mode of ['selection', 'unknown', 'panel', 'visibility', 'poll', 'final', 'readonly-final']) {
      const state = page(mode);
      const result = await read({ entity_id: 'selected', prepare: mode !== 'readonly-final', _deps: { evaluate: async expression => state.evaluate(expression) } });
      checkFailure(result, mode, state);
    }
  });
}

test('MCP and CLI retain strategy failures through their real external JSON responses', { timeout: 60000 }, async () => {
  let state;
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const port = server.address().port;
    if (req.url === '/json/list') res.end(JSON.stringify([{ id: 'chart', type: 'page', url: 'https://jp.tradingview.com/chart/EXPECTED/', webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/chart` }]));
    else if (req.url === '/json/protocol') res.end(JSON.stringify({ version: { major: '1', minor: '3' }, domains: ['Runtime', 'Page', 'DOM'].map(domain => ({ domain, commands: [{ name: 'enable' }, ...(domain === 'Runtime' ? [{ name: 'evaluate', parameters: [{ name: 'expression', type: 'string' }], returns: [{ name: 'result', type: 'object' }] }] : [])] })) }));
    else { res.statusCode = 404; res.end('{}'); }
  });
  const ws = new WebSocket.Server({ server });
  ws.on('connection', socket => socket.on('message', message => {
    const call = JSON.parse(String(message)); let result = {};
    if (call.method === 'Runtime.evaluate') {
      try { result = { result: { value: state.evaluate(call.params.expression) } }; }
      catch (error) { result = { exceptionDetails: { text: error.message } }; }
    }
    socket.send(JSON.stringify({ id: call.id, result }));
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, TV_CDP_HOST: '127.0.0.1', TV_CDP_PORT: String(server.address().port), TV_CDP_TARGET_ID: 'chart' };
  const client = new Client({ name: 'tv6-failure-verification', version: '1' });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['src/server.js'], env, stderr: 'pipe' }));
    for (const [tool, command] of [['data_get_strategy_results', 'strategy'], ['data_get_trades', 'trades'], ['data_get_equity', 'equity']]) {
      for (const mode of ['unknown', 'visibility', 'poll', 'final']) {
        state = page(mode);
        const response = await client.callTool({ name: tool, arguments: { entity_id: 'selected', prepare: true } });
        checkFailure(JSON.parse(response.content[0].text), mode, state);
        state = page(mode);
        const result = await new Promise((resolve, reject) => {
          const child = spawn(process.execPath, ['src/cli/index.js', 'data', command, '--entity-id', 'selected', '--prepare'], { env });
          let stdout = '', stderr = '';
          child.stdout.on('data', data => stdout += data); child.stderr.on('data', data => stderr += data);
          child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
        });
        assert.equal(result.code, 0, result.stderr); // CLI publishes success:false JSON, not exit-code success proof
        checkFailure(JSON.parse(result.stdout), mode, state);
      }
    }
  } finally {
    await client.close();
    for (const socket of ws.clients) socket.terminate();
    ws.close(); await new Promise(resolve => server.close(resolve));
  }
});
