/** Shared CDP identity boundary. An explicit ID never bypasses eligibility. */
import { fileURLToPath } from 'node:url';
import { resolve, join, sep } from 'node:path';
import { homedir } from 'node:os';

export function parsePort(value = 9222) {
  if (!/^\d+$/.test(String(value)) || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error('CDP port must be an integer from 1 to 65535');
  }
  return Number(value);
}

export function isChartTarget(target) {
  if (target?.type !== 'page' || typeof target.id !== 'string' || !target.id) return false;
  try {
    const u = new URL(target.url);
    return u.protocol === 'https:' && ['tradingview.com', 'www.tradingview.com'].includes(u.hostname)
      && !u.username && !u.password && !u.port && /^\/chart\/(?:[^/]+\/?)?$/.test(u.pathname);
  } catch { return false; }
}

export function selectChartTarget(targets, id) {
  if (!Array.isArray(targets)) throw new Error('Invalid CDP target list');
  const eligible = targets.filter(isChartTarget);
  const matches = id == null ? eligible : eligible.filter(t => t.id === id);
  if (matches.length !== 1) throw new Error(id != null
    ? 'Explicit CDP target is missing, duplicated or not an eligible TradingView chart'
    : matches.length ? 'Multiple TradingView charts: select TV_CDP_TARGET_ID or switch to an explicit tab' : 'No eligible TradingView chart target');
  return matches[0];
}

// App-owned file targets are separate from web charts. These are installed
// application resources, never a title match or an arbitrary */window/index.html.
const resourceRoots = process.platform === 'darwin' ? [
  '/Applications/TradingView.app/Contents/Resources',
  join(homedir(), 'Applications/TradingView.app/Contents/Resources'),
] : process.platform === 'win32' ? [
  join(process.env.LOCALAPPDATA || homedir(), 'TradingView/resources'),
  join(process.env.PROGRAMFILES || '', 'TradingView/resources'),
] : ['/opt/TradingView/resources', '/usr/share/tradingview/resources'];

export function isAppTarget(target, kind) {
  if (target?.type !== 'page' || !target.id || !['window', 'new-tab'].includes(kind)) return false;
  try {
    const u = new URL(target.url);
    if (u.protocol !== 'file:' || u.host || u.search || u.hash) return false;
    const p = resolve(fileURLToPath(u));
    return resourceRoots.some(root => p === join(resolve(root), 'app.asar', 'app', kind, 'index.html'))
      && !p.includes(`${sep}..${sep}`);
  } catch { return false; }
}

export async function listTargets(host, port) {
  const response = await fetch(`http://${host}:${parsePort(port)}/json/list`);
  if (!response.ok) throw new Error(`CDP target list HTTP ${response.status}`);
  const targets = await response.json();
  if (!Array.isArray(targets)) throw new Error('Invalid CDP target list');
  return targets;
}
