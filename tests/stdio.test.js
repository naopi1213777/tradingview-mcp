// Real stdio initialize/list/call against this source; Pine analysis is offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
test('SDK1 stdio initialization, tool schemas and bounded offline call', async () => {
  const client = new Client({ name: 'tv6-verification', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: ['src/server.js'], cwd: new URL('..', import.meta.url).pathname, stderr: 'pipe' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.length > 70);
    const strategy = tools.find(t => t.name === 'data_get_strategy_results');
    assert.ok(strategy.inputSchema.properties.entity_id);
    assert.ok(strategy.inputSchema.properties.prepare);
    assert.ok(tools.find(t => t.name === 'ui_evaluate').description.includes('same-account'));
    const result = await client.callTool({ name: 'pine_analyze', arguments: { source: '//@version=6\nindicator("Offline test")\nplot(close)' } });
    assert.equal(result.isError, undefined);
    assert.equal(JSON.parse(result.content[0].text).success, true);
  } finally { await client.close(); }
});
