import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import htmlPartials from './plugins/html-partials.js';
import { renderNetworkSvg } from './src/data/network-svg.js';

const root = import.meta.dirname;

// Every route is a real HTML file. Add new pages here.
const pages = {
  home: 'index.html',
  services: 'services/index.html',
  fleet: 'fleet/index.html',
  about: 'about/index.html',
  tracking: 'tracking/index.html',
  contact: 'contact/index.html',
  notFound: '404.html',
};

export default defineConfig({
  plugins: [htmlPartials({ renderers: { 'network-map': renderNetworkSvg } })],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    // three.js lives in a lazy chunk loaded only for capable devices.
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      input: Object.fromEntries(
        Object.entries(pages).map(([name, file]) => [name, resolve(root, file)]),
      ),
    },
  },
});
