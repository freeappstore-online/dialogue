import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from '@freeappstore/sdk/pwa-config';
// Word clips (pauses between words, #13) are not precached: they would add 600+ requests to the first-visit
// install (#8). Online they stream; offline, word-by-word playback falls back to the precached whole line.
export default defineConfig({ plugins: [react(), tailwindcss(), VitePWA(pwaOptions({ workbox: { globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,json,mp3}'], globIgnores: ['**/audio/words/**'] } }))] });
