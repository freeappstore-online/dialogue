import { useEffect, useState } from 'react';
import { scenarioById } from './dialogue/catalog';
import { walk } from './dialogue/model';

// App-owned route state lives in the hash, so the whole conversation survives
// a trip to the Shell's Profile screen (which returns to the full URL).
// A conversation is its path of choice ids, so Back undoes one turn.
export type Route =
  | { view: 'home' }
  | { view: 'play'; scenarioId: string; path: string[]; nodeId: string }
  | { view: 'script'; scenarioId: string }
  | { view: 'find'; scenarioId?: string; path?: string[]; nodeId?: string };

export function parseRoute(hash: string): Route {
  const [view, a, ...rest] = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const scenario = scenarioById(a);
  if (view === 'play' && scenario) return { view, scenarioId: scenario.id, ...walk(scenario, rest) };
  if (view === 'script' && scenario) return { view, scenarioId: scenario.id };
  if (view === 'find') return scenario ? { view, scenarioId: scenario.id, ...walk(scenario, rest) } : { view };
  return { view: 'home' };
}

export const href = {
  home: '#/',
  play: (scenarioId: string, path: string[] = []) => ['#/play', scenarioId, ...path].join('/'),
  script: (scenarioId: string) => `#/script/${scenarioId}`,
  /** The phrase finder; from a conversation, with its path so Back returns to the same thread. */
  find: (scenarioId?: string, path: string[] = []) => (scenarioId ? ['#/find', scenarioId, ...path].join('/') : '#/find'),
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
