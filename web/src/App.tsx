import { useEffect } from 'react';
import { initApp } from '@freeappstore/sdk';
import { Shell } from '@freeappstore/sdk/ui';
import { DialoguePlayer } from './components/DialoguePlayer';
import { Finder } from './components/Finder';
import { Home } from './components/Home';
import { ScriptView } from './components/ScriptView';
import { scenarioById } from './dialogue/catalog';
import { useRoute, type Route } from './route';

export const fas = initApp({ appId: 'dialogue' });

function Screen({ route }: { route: Route }) {
  switch (route.view) {
    case 'play': return <DialoguePlayer key={route.scenarioId} scenario={scenarioById(route.scenarioId)!} nodeId={route.nodeId} />;
    case 'script': return <ScriptView scenario={scenarioById(route.scenarioId)!} />;
    case 'find': return <Finder key={`${route.scenarioId}/${route.nodeId}`} scenarioId={route.scenarioId} nodeId={route.nodeId} />;
    default: return <Home />;
  }
}

export default function App() {
  const route = useRoute();
  const page = route.view === 'play' ? `${route.view}/${route.scenarioId}/${route.nodeId}` : JSON.stringify(route);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  return <Shell app={fas} appName="Dialogue"><Screen route={route} /></Shell>;
}
