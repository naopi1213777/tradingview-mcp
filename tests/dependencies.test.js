// In-memory middleware compatibility only; no HTTP listener or account traffic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
const require = createRequire(import.meta.url);
const bodyParser = require('body-parser');
const sdkRequire = createRequire(require.resolve('@modelcontextprotocol/sdk/server/mcp.js'));
const parserRequire = createRequire(require.resolve('body-parser'));

test('actual content-type majors coexist under valid consumer ranges', () => {
  assert.match(sdkRequire('content-type/package.json').version, /^1\./);
  assert.match(parserRequire('content-type/package.json').version, /^2\./);
  assert.match(require('@hono/node-server/package.json').version, /^1\./);
});
async function parse(kind, contentType, text) {
  const req = Readable.from([Buffer.from(text)]);
  req.headers = { 'content-type': contentType, 'content-length': String(Buffer.byteLength(text)) };
  req.method = 'POST'; req.socket = {};
  const error = await new Promise(resolve => bodyParser[kind]()(req, {}, resolve));
  return { error, body: req.body };
}
test('body-parser JSON/text/form valid and invalid Content-Type/charset', async () => {
  assert.deepEqual((await parse('json', 'application/json; charset=utf-8', '{"ok":true}')).body, { ok: true });
  assert.equal((await parse('json', 'application/json; charset=bogus', '{}')).error.status, 415);
  assert.equal((await parse('text', 'text/plain; charset=utf-8', 'ok')).body, 'ok');
  assert.deepEqual((await parse('urlencoded', 'application/x-www-form-urlencoded; charset=utf-8', 'a=1')).body, { a: '1' });
  assert.equal((await parse('urlencoded', 'application/x-www-form-urlencoded; charset=utf-16', 'a=1')).error.status, 415);
  assert.equal((await parse('json', 'invalid', '{}')).body, undefined);
  assert.equal((await parse('json', 'application/json', '{broken')).error.status, 400);
});
