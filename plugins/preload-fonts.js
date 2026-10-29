// Preloads the fonts every page renders above the fold, so text is drawn in
// its final face on first paint (no swap, no layout shift). Font files are
// content-hashed at build time, so the links are injected from the bundle.
export default function preloadFonts({ patterns = [] } = {}) {
  return {
    name: 'vf-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        if (!bundle) return html;
        const files = Object.keys(bundle).filter((name) => patterns.some((pattern) => pattern.test(name)));
        return files.map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head-prepend',
        }));
      },
    },
  };
}
