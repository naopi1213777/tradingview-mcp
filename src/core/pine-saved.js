/* global window, document, crypto, TextEncoder */
import { evaluateAsync } from '../connection.js';

// Exact selection is shared with the page operation; never guess a version.
export function selectSavedScript(scripts, { name, script_id, version }) {
  if (!Array.isArray(scripts)) throw new Error('Invalid saved-script list');
  const title = name == null ? null : String(name).trim().toLowerCase();
  if (!script_id && !title) throw new Error('Provide script_id or an exact saved-script name');
  const matches = scripts.filter(s => script_id
    ? s.scriptIdPart === script_id
    : [s.scriptName, s.scriptTitle].some(n => typeof n === 'string' && n.toLowerCase() === title));
  if (matches.length !== 1) throw new Error('Saved script missing or ambiguous; provide exact script_id');
  const script = matches[0];
  if (title && ![script.scriptName, script.scriptTitle].some(n => typeof n === 'string' && n.toLowerCase() === title)) {
    throw new Error('Saved script ID and name disagree');
  }
  const chosenVersion = version ?? script.version;
  if (!script.scriptIdPart || chosenVersion == null || !/^\d+(?:\.\d+)?$/.test(String(chosenVersion)) || Number(chosenVersion) <= 0) {
    throw new Error('An exact saved script ID and version are required');
  }
  return { scriptIdPart: script.scriptIdPart, version: String(chosenVersion), name: script.scriptName || script.scriptTitle };
}

// Runs only in the already-validated chart. No editor opening, source injection,
// compile/save, fallback to a new draft, or automatic retry/restoration.
export async function openSavedInPage(options, selectScript) {
  const fail = (error, details = {}) => ({ success: false, source: 'native_saved_editor', error, ...details });
  const pa = window.TradingViewApi?._pineEditorApi;
  if (!pa?.listSavedScripts || !pa?.getSource) return fail('Native saved-script API unavailable');
  const facades = [pa.getDialogFacade?.(), pa.getBottomFacade?.()].filter(Boolean);
  if (facades.length !== 1) return fail('Display one Pine editor before opening a saved script');
  const f = facades[0], initialURL = window.location.href;
  if (!['isModified', 'isDraft', 'getScriptIdVersion', 'getSource', '_initScriptVersion'].every(k => typeof f[k] === 'function')
      || typeof f._editorRef?.current?.saveViewState !== 'function') return fail('Native identity/state API unavailable');
  const hasDialog = () => Array.from(document.querySelectorAll('[role="dialog"]')).some(e => e.getClientRects().length > 0);
  const clean = () => f.isModified() === false && f.isDraft() === false;
  if (!clean() || hasDialog()) return fail('Dirty/draft editor or confirmation: saved open refused');
  const original = f.getScriptIdVersion();
  if (!original?.scriptIdPart || !original.version) return fail('Current saved editor identity unavailable');
  const same = (a, b) => a?.scriptIdPart === b?.scriptIdPart && String(a?.version) === String(b?.version);
  const currentFacade = () => (pa.getDialogFacade?.() === f || pa.getBottomFacade?.() === f)
    && window.location.href === initialURL;
  let selected, originalSource, saved, view;
  try {
    selected = selectScript(await pa.listSavedScripts(), options);
    originalSource = await f.getSource();
    const originalSaved = await pa.getSource(original.scriptIdPart, original.version);
    saved = await pa.getSource(selected.scriptIdPart, selected.version);
    if (String(originalSaved?.version) !== String(original.version) || originalSaved?.source !== originalSource) {
      return fail('Current buffer does not match its exact saved version');
    }
    if (String(saved?.version) !== selected.version || typeof saved?.source !== 'string' || !saved.source.length) {
      return fail('Requested saved version/source unavailable');
    }
    view = f._editorRef.current.saveViewState();
    if (!view || !currentFacade() || !same(f.getScriptIdVersion(), original) || !clean() || hasDialog()
        || await f.getSource() !== originalSource) return fail('Editor changed during saved-source verification');
  } catch {
    return fail('Exact saved-script selection/source verification failed');
  }
  const digest = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
    .map(x => x.toString(16).padStart(2, '0')).join('');
  const previous = { ...original, source_sha256: await digest(originalSource), view_state: view, placement: f.placement };
  const attempted = !same(original, selected);
  // Recheck after the asynchronous digest, immediately before the native call.
  if (!currentFacade() || !same(f.getScriptIdVersion(), original) || !clean() || hasDialog()) {
    return fail('Editor changed before native saved open');
  }
  try {
    if (attempted) await f._initScriptVersion({ scriptIdPart: selected.scriptIdPart, version: selected.version });
    const source = await f.getSource(), actual = f.getScriptIdVersion();
    if (!currentFacade() || !same(actual, selected) || source !== saved.source || !clean() || hasDialog()) {
      return fail('Native saved-open identity/source/state mismatch; inspect before retry', {
        script_id: selected.scriptIdPart, version: selected.version, actual_identity: actual,
        native_open_attempted: attempted, restoration_required: attempted, previous,
      });
    }
    return { success: true, source: 'native_saved_editor', name: selected.name,
      script_id: actual.scriptIdPart, version: String(actual.version), opened: true, already_open: !attempted,
      lines: source.split('\n').length, source_sha256: await digest(saved.source), editor_sha256: await digest(source),
      dirty: false, previous };
  } catch {
    // A native rejection may have changed state. Never replay or inject text to
    // manufacture success; leave the exact before/after identities for inspection.
    return fail('Native version-open failed; inspect editor state before retry', {
      script_id: selected.scriptIdPart, version: selected.version, actual_identity: f.getScriptIdVersion(),
      native_open_attempted: attempted, restoration_required: attempted, previous,
    });
  }
}

export async function openSavedScript({ name, script_id, version, _deps } = {}) {
  const evalIn = _deps?.evaluateAsync || evaluateAsync;
  return evalIn(`(${openSavedInPage.toString()})(${JSON.stringify({ name, script_id, version })}, ${selectSavedScript.toString()})`);
}
