import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import htmlPartials from './plugins/html-partials.js';
import preloadFonts from './plugins/preload-fonts.js';
import { renderNetworkSvg } from './src/data/network-svg.js';
import {
  renderCredits,
  renderFleetClasses,
  renderHubOptions,
  renderServiceHead,
  renderServiceOptions,
  renderServicePage,
  renderServicesIndex,
} from './src/data/render-pages.js';
import { SERVICES } from './src/data/services.js';

const root = import.meta.dirname;

// Every route is a real HTML file. Service detail pages are thin stubs whose
// content is rendered from src/data/services.js at build time.
const pages = {
  home: 'index.html',
  services: 'services/index.html',
  ...Object.fromEntries(SERVICES.map(({ slug }) => [`service-${slug}`, `services/${slug}/index.html`])),
  fleet: 'fleet/index.html',
  about: 'about/index.html',
  tracking: 'tracking/index.html',
  contact: 'contact/index.html',
  notFound: '404.html',
};

export default defineConfig({
  plugins: [
    htmlPartials({
      renderers: {
        'network-map': renderNetworkSvg,
        'services-index': renderServicesIndex,
        'service-head': renderServiceHead,
        'service-page': renderServicePage,
        'fleet-classes': renderFleetClasses,
        credits: renderCredits,
        'service-options': renderServiceOptions,
        'hub-options': renderHubOptions,
      },
    }),
    // The Latin subset of Archivo sets every headline and paragraph.
    preloadFonts({ patterns: [/archivo-latin-wdth-normal-[\w-]+\.woff2$/] }),
  ],
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
