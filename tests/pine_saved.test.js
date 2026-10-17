// Offline native-editor contracts; no TradingView process or proprietary source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { selectSavedScript } from '../src/core/pine-saved.js';
import { openScript } from '../src/core/pine.js';

const scripts = [
  { scriptIdPart: 'A', version: '1.0', scriptName: 'Alpha' },
  { scriptIdPart: 'B', version: '2.0', scriptName: 'Beta' },
];
test('saved selection rejects fuzzy names, duplicate names, missing versions and conflicting IDs', () => {
  assert.throws(() => selectSavedScript(scripts, { name: 'Al' }), /missing/);
  assert.throws(() => selectSavedScript([...scripts, { ...scripts[0], scriptIdPart: 'C' }], { name: 'Alpha' }), /ambiguous/);
  assert.throws(() => selectSavedScript([{ scriptIdPart: 'A', scriptName: 'Alpha' }], { name: 'Alpha' }), /version/);
  assert.throws(() => selectSavedScript(scripts, { script_id: 'A', name: 'Beta' }), /disagree/);
  assert.throws(() => selectSavedScript(scripts, { script_id: 'B', version: 'latest' }), /version/);
  assert.deepEqual(selectSavedScript(scripts, { name: 'beta' }), { scriptIdPart: 'B', version: '2.0', name: 'Beta' });
  assert.equal(selectSavedScript(scripts, { script_id: 'B', version: '1.0' }).version, '1.0');
});

function editorFixture(options = {}) {
  const state = { identity: { scriptIdPart: 'A', version: '1.0' }, source: 'source A', dirty: false, calls: [], ...options };
  const sources = { A: 'source A', B: 'source B' };
  const facade = {
    placement: 'dialog', isModified: () => state.dirty, isDraft: () => !!state.draft,
    getScriptIdVersion: () => state.identity, getSource: async () => state.source,
    _editorRef: { current: { saveViewState: () => ({ cursorState: [{ line: 3, column: 2 }] }) } },
    async _initScriptVersion(id) {
      state.calls.push({ ...id });
      state.identity = state.wrongIdentity ? { scriptIdPart: 'OTHER', version: id.version } : { ...id };
      state.source = sources[id.scriptIdPart];
      if (state.rejectAfterChange) throw new Error('native failure');
    },
    openScript() { throw new Error('Do not use the new-draft fallback path'); },
    setValue() { throw new Error('Source injection forbidden'); },
  };
  const pa = {
    listSavedScripts: async () => scripts,
    getDialogFacade: () => state.closed ? null : facade, getBottomFacade: () => null,
    getSource: async (id, version) => {
      if (id === 'B' && state.editDuringFetch) state.dirty = true;
      return { source: sources[id], version: state.wrongVersion && id === 'B' ? '99.0' : version };
    },
  };
  const context = vm.createContext({ window: { location: { href: 'https://jp.tradingview.com/chart/test/' }, TradingViewApi: { _pineEditorApi: pa } },
    document: { querySelectorAll: () => state.dialog ? [{ getClientRects: () => [1] }] : [] }, crypto: webcrypto, TextEncoder });
  return { state, run: opts => openScript({ ...opts, _deps: { evaluateAsync: async expression =>
    JSON.parse(JSON.stringify(await vm.runInContext(expression, context))) } }) };
}
test('native saved open verifies exact identity/source and reports the prior state without source text', async () => {
  const f = editorFixture();
  const result = await f.run({ script_id: 'B', version: '2.0' });
  assert.equal(result.success, true);
  assert.equal(result.script_id, 'B'); assert.equal(result.version, '2.0');
  assert.equal(result.editor_sha256, result.source_sha256);
  assert.equal(result.previous.scriptIdPart, 'A');
  assert.equal(result.previous.view_state.cursorState[0].line, 3);
  assert.deepEqual(f.state.calls, [{ scriptIdPart: 'B', version: '2.0' }]);
  assert.equal(JSON.stringify(result).includes('source A'), false);
  assert.equal(JSON.stringify(result).includes('source B'), false);
});
test('dirty, draft, dialog, closed, changed buffer and concurrent edit refuse before a native mutation', async () => {
  for (const options of [{ dirty: true }, { draft: true }, { dialog: true }, { closed: true },
    { source: 'unsaved buffer' }, { editDuringFetch: true }, { wrongVersion: true }]) {
    const f = editorFixture(options), result = await f.run({ script_id: 'B', version: '2.0' });
    assert.equal(result.success, false, JSON.stringify(options));
    assert.equal(f.state.calls.length, 0);
  }
});
test('native mismatch and partial rejection are failures with inspection evidence, never retried', async () => {
  for (const options of [{ wrongIdentity: true }, { rejectAfterChange: true }]) {
    const f = editorFixture(options), result = await f.run({ script_id: 'B', version: '2.0' });
    assert.equal(result.success, false);
    assert.equal(result.native_open_attempted, true); assert.equal(result.restoration_required, true);
    assert.equal(result.previous.scriptIdPart, 'A'); assert.ok(result.actual_identity);
    assert.equal(f.state.calls.length, 1);
  }
});
test('already-open exact saved identity is verified without an unnecessary reopen', async () => {
  const f = editorFixture(), result = await f.run({ script_id: 'A', version: '1.0' });
  assert.equal(result.success, true); assert.equal(result.already_open, true); assert.equal(f.state.calls.length, 0);
});
