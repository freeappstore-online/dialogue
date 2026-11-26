import { useEffect, useState } from 'react';
import { scenarioById } from './dialogue/catalog';

// App-owned route state lives in the hash, so the reading position survives
// a trip to the Shell's Profile screen (which returns to the full URL).
export type Route =
  | { view: 'home' }
  | { view: 'play'; scenarioId: string; nodeId: string }
  | { view: 'script'; scenarioId: string }
  | { view: 'find'; scenarioId?: string; nodeId?: string };

export function parseRoute(hash: string): Route {
  const [view, a, b] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const scenario = scenarioById(a);
  if (view === 'play' && scenario) return { view, scenarioId: scenario.id, nodeId: b && scenario.nodes[b] ? b : scenario.start };
  if (view === 'script' && scenario) return { view, scenarioId: scenario.id };
  if (view === 'find') return scenario && b && scenario.nodes[b] ? { view, scenarioId: scenario.id, nodeId: b } : { view };
  return { view: 'home' };
}

export const href = {
  home: '#/',
  play: (scenarioId: string, nodeId?: string) => `#/play/${scenarioId}${nodeId ? `/${nodeId}` : ''}`,
  script: (scenarioId: string) => `#/script/${scenarioId}`,
  find: (scenarioId?: string, nodeId?: string) => (scenarioId && nodeId ? `#/find/${scenarioId}/${nodeId}` : '#/find'),
};

export function navigate(to: string): void {
  window.location.hash = to;
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return parseRoute(hash);
}
