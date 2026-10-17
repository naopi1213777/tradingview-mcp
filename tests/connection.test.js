// A local fake CDP peer exercises the real transport/cache; no browser/account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import WebSocket from 'ws';
import vm from 'node:vm';
test('cached navigation/disappearance refuses work instead of selecting another chart', async () => {
  let url = 'https://jp.tradingview.com/chart/layout/';
  let listed = true;
  const expressions = [];
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const port = server.address().port;
    if (req.url === '/json/list') res.end(JSON.stringify(listed ? [{ id: 'chart', type: 'page', url, webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/chart` }] : []));
    else if (req.url === '/json/protocol') res.end(JSON.stringify({ version: { major: '1', minor: '3' }, domains: ['Runtime', 'Page', 'DOM'].map(domain => ({ domain, commands: [{ name: 'enable' }, ...(domain === 'Runtime' ? [{ name: 'evaluate', parameters: [{ name: 'expression', type: 'string' }], returns: [{ name: 'result', type: 'object' }] }] : [])] })) }));
    else { res.statusCode = 404; res.end('{}'); }
  });
  const ws = new WebSocket.Server({ server });
  ws.on('connection', socket => socket.on('message', message => {
    const call = JSON.parse(String(message));
    let result = {};
    if (call.method === 'Runtime.evaluate') {
      expressions.push(call.params.expression);
      try { result = { result: { value: vm.runInNewContext(call.params.expression, { location: { href: url }, URL }) } }; }
      catch (e) { result = { exceptionDetails: { text: e.message } }; }
    }
    socket.send(JSON.stringify({ id: call.id, result }));
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const previous = process.env.TV_CDP_PORT;
  process.env.TV_CDP_PORT = String(server.address().port);
  const connection = await import(`../src/connection.js?offline=${server.address().port}`);
  try {
    assert.equal(await connection.evaluate('42'), 42);
    const before = expressions.length;
    url = 'https://evil.example/';
    await assert.rejects(connection.evaluate('globalThis.mutated = true'), /not an eligible|navigated/);
    assert.equal(expressions.length, before);
    listed = false;
    await assert.rejects(connection.getClient(), /missing/);
    assert.equal(expressions.length, before);
  } finally {
    await connection.disconnect();
    if (previous == null) delete process.env.TV_CDP_PORT; else process.env.TV_CDP_PORT = previous;
    ws.close(); await new Promise(resolve => server.close(resolve));
  }
});
