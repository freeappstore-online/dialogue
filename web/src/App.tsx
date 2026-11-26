import { initApp } from '@freeappstore/sdk';
import { Shell } from '@freeappstore/sdk/ui';
import { DialoguePlayer } from './components/DialoguePlayer';
export const fas = initApp({ appId: 'dialogue' });
export default function App() { return <Shell app={fas} appName="Dialogue"><DialoguePlayer /></Shell>; }
