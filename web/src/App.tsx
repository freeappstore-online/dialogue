import { useEffect } from 'react';
import { initApp } from '@freeappstore/sdk';
import { Shell } from '@freeappstore/sdk/ui';
import { DialoguePlayer } from './components/DialoguePlayer';
import { Finder } from './components/Finder';
import { Home } from './components/Home';
import { DisplayProvider } from './components/prefs';
import { ScriptView } from './components/ScriptView';
import { scenarioById } from './dialogue/catalog';
import { useRoute, type Route } from './route';

export const fas = initApp({ appId: 'dialogue' });

function Screen({ route }: { route: Route }) {
  switch (route.view) {
    case 'play': return <DialoguePlayer key={route.scenarioId} scenario={scenarioById(route.scenarioId)!} path={route.path} nodeId={route.nodeId} />;
    case 'script': return <ScriptView scenario={scenarioById(route.scenarioId)!} />;
    case 'find': return <Finder key={`${route.scenarioId}/${route.nodeId}`} scenarioId={route.scenarioId} path={route.path} nodeId={route.nodeId} />;
    default: return <Home />;
  }
}

export default function App() {
  const route = useRoute();
  // Screens start at the top; a conversation scrolls itself to its newest message.
  const screen = route.view === 'play' ? 'play' : JSON.stringify(route);
  useEffect(() => { if (screen !== 'play') window.scrollTo(0, 0); }, [screen]);
  // Each screen renders the SDK StatusBar inside its own bottom dock.
  return <DisplayProvider><Shell app={fas} appName="Dialogue" statusBar={false}><Screen route={route} /></Shell></DisplayProvider>;
}
