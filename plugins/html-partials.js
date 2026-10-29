// Build-time HTML partials.
//
//   <!-- @include header.html -->   is replaced with partials/header.html
//   <!-- @render network-map -->     is replaced with renderers['network-map']()
//   <meta name="vf-page" content="services">   marks the current section, so
//   any link carrying data-nav="services" receives aria-current="page".
//
// Partials may include other partials. No runtime JS is involved.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const INCLUDE = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
const RENDER = /<!--\s*@render\s+([\w-]+)\s*-->/g;
const PAGE_META = /<meta\s+name="vf-page"\s+content="([\w-]+)"\s*\/?>/;

export default function htmlPartials({ dir = 'partials', renderers = {} } = {}) {
  let root = process.cwd();

  const expand = (html, depth = 0) => {
    if (depth > 5) throw new Error('html-partials: include depth exceeded');
    return html.replace(INCLUDE, (_, name) =>
      expand(readFileSync(resolve(root, dir, name), 'utf8'), depth + 1),
    );
  };

  return {
    name: 'vf-html-partials',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      const partialsDir = resolve(root, dir);
      server.watcher.add(partialsDir);
      server.watcher.on('change', (file) => {
        if (file.startsWith(partialsDir)) server.ws.send({ type: 'full-reload' });
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let out = expand(html).replace(RENDER, (_, name) => {
          if (!renderers[name]) throw new Error(`html-partials: no renderer named "${name}"`);
          return renderers[name]();
        });
        const page = out.match(PAGE_META)?.[1];
        if (page) {
          out = out.replaceAll(`data-nav="${page}"`, `data-nav="${page}" aria-current="page"`);
        }
        return out;
      },
    },
  };
}
