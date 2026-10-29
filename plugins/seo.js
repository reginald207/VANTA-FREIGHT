// Search and social metadata at build time. Each page's <title> and meta
// description become its Open Graph and Twitter card; with a known site URL
// the plugin also adds canonical links and emits sitemap.xml. robots.txt is
// always emitted.
//
// The site URL comes from SITE_URL, or from Vercel's build-time
// VERCEL_PROJECT_PRODUCTION_URL. Without one, absolute-URL tags (canonical,
// og:url, og:image) and the sitemap are skipped rather than guessed.
import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';

const OG_IMAGE = '/og/vanta-freight.jpg';
const OG_IMAGE_ALT = 'The VANTA FREIGHT tractor-trailer at night, with the line "We move what moves the world."';

export function resolveSiteUrl(env = process.env) {
  const raw = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return raw ? raw.replace(/\/+$/, '') : null;
}

const NOINDEX = /<meta\s+name="robots"\s+content="noindex"/;
const attr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// index.html -> '/', services/linehaul/index.html -> '/services/linehaul/'.
function routeFor(root, filename) {
  const file = relative(root, filename).split(sep).join('/');
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file.replace(/\.html$/, '')}`;
}

export default function seo({ siteUrl = resolveSiteUrl() } = {}) {
  let root = process.cwd();
  let inputs = [];

  return {
    name: 'vf-seo',
    configResolved(config) {
      root = config.root;
      const input = config.build.rolldownOptions?.input ?? config.build.rollupOptions?.input ?? {};
      inputs = Object.values(typeof input === 'string' ? [input] : input);
      if (!siteUrl && config.command === 'build') {
        config.logger.warn(
          '[vf-seo] No SITE_URL or VERCEL_PROJECT_PRODUCTION_URL: skipping canonical links, og:url, og:image and sitemap.xml.',
        );
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, { filename }) {
        const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
        const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1];
        if (!title) return html;

        const route = routeFor(root, filename);
        const indexable = !NOINDEX.test(html);

        const tags = [
          ['meta', { property: 'og:type', content: 'website' }],
          ['meta', { property: 'og:site_name', content: 'VANTA FREIGHT' }],
          ['meta', { property: 'og:title', content: title }],
          ['meta', { property: 'og:description', content: description ?? '' }],
          ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        ];
        if (siteUrl) {
          tags.push(
            ['meta', { property: 'og:url', content: `${siteUrl}${route}` }],
            ['meta', { property: 'og:image', content: `${siteUrl}${OG_IMAGE}` }],
            ['meta', { property: 'og:image:width', content: '1200' }],
            ['meta', { property: 'og:image:height', content: '630' }],
            ['meta', { property: 'og:image:alt', content: OG_IMAGE_ALT }],
          );
          if (indexable) tags.push(['link', { rel: 'canonical', href: `${siteUrl}${route}` }]);
        }

        const markup = tags
          .map(([tag, attrs]) => {
            const pairs = Object.entries(attrs).map(([key, value]) => `${key}="${attr(value)}"`);
            return `<${tag} ${pairs.join(' ')} />`;
          })
          .join('\n    ');
        return html.replace('</head>', `    ${markup}\n  </head>`);
      },
    },
    generateBundle() {
      const lines = ['User-agent: *', 'Allow: /'];
      if (siteUrl) {
        // From the page inputs: Vite applies late HTML transforms after this
        // hook, so pages can't be collected as they are transformed.
        const urls = inputs
          .filter((file) => !NOINDEX.test(readFileSync(file, 'utf8')))
          .map((file) => routeFor(root, file))
          .sort()
          .map((route) => `  <url><loc>${siteUrl}${route}</loc></url>`)
          .join('\n');
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        });
        lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${lines.join('\n')}\n` });
    },
  };
}
