// Fleet page: class switcher, posters, and the lazy 3D turntable.
import './base.js';
import '../styles/pages/content.css';
import { applyTier, detectTier } from '../core/capabilities.js';
import { onReducedMotion } from '../core/motion-preference.js';
import { initReveals } from '../core/reveal.js';
import { FLEET } from '../data/fleet.js';

const root = document.documentElement;
const params = new URLSearchParams(window.location.search);
const forcedTier = params.get('tier');
const READY_TIMEOUT_MS = forcedTier === '2' ? 15000 : 3000;
// Dev-only poster capture (`?capture=semi|rigid|tractor`).
const capture = import.meta.env.DEV ? params.get('capture') : null;

const viewport = document.querySelector('.turntable__viewport');
const poster = viewport.querySelector('.turntable__poster');
const tabs = [...document.querySelectorAll('.turntable__tab')];
const hint = document.querySelector('.turntable__hint');

let turntable = null;

function posterFor(variant) {
  const vehicle = FLEET.find((entry) => entry.variant === variant);
  poster.querySelector('source').srcset = `/posters/fleet-${variant}.webp`;
  const img = poster.querySelector('img');
  img.src = `/posters/fleet-${variant}.jpg`;
  img.alt = `${vehicle.code} ${vehicle.name.toLowerCase()}, seen from the front three-quarter view`;
}

function selectVariant(variant) {
  tabs.forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.variant === variant)));
  posterFor(variant);
  turntable?.setVariant(variant);
  if (turntable) {
    const vehicle = FLEET.find((entry) => entry.variant === variant);
    viewport.setAttribute('aria-label', `Turn the ${vehicle.code} ${vehicle.name.toLowerCase()}`);
  }
}

tabs.forEach((tab) => tab.addEventListener('click', () => selectVariant(tab.dataset.variant)));

// The live viewport is a slider: arrow keys and dragging turn the vehicle.
function enableControls() {
  const sync = () => {
    viewport.setAttribute('aria-valuenow', String(turntable.angle));
    viewport.setAttribute('aria-valuetext', `${turntable.angle} degrees`);
  };
  Object.entries({
    role: 'slider',
    tabindex: '0',
    'aria-valuemin': '0',
    'aria-valuemax': '359',
    'aria-label': 'Turn the VF-01 tractor-trailer',
  }).forEach(([name, value]) => viewport.setAttribute(name, value));
  sync();
  hint.classList.remove('is-inactive');

  // Any attention stops the short auto-rotation, so the value holds still.
  const settle = () => {
    turntable?.stopAuto();
    if (turntable) sync();
  };
  viewport.addEventListener('focus', settle);
  viewport.addEventListener('pointerenter', settle);

  const steps = { ArrowLeft: -15, ArrowDown: -15, ArrowRight: 15, ArrowUp: 15, PageDown: -45, PageUp: 45 };
  viewport.addEventListener('keydown', (event) => {
    if (!turntable || !(event.key in steps)) return;
    event.preventDefault();
    turntable.rotateBy(steps[event.key]);
    sync();
  });

  let dragX = null;
  viewport.addEventListener('pointerdown', (event) => {
    if (!turntable) return;
    dragX = event.clientX;
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', (event) => {
    if (dragX === null || !turntable) return;
    turntable.rotateBy((event.clientX - dragX) * 0.4);
    dragX = event.clientX;
    sync();
  });
  const endDrag = () => {
    dragX = null;
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
}

function disableControls() {
  ['role', 'tabindex', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-label'].forEach(
    (name) => viewport.removeAttribute(name),
  );
  hint.classList.add('is-inactive');
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('stage-timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function bootTurntable() {
  const canvas = document.createElement('canvas');
  canvas.className = 'turntable__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  viewport.append(canvas);
  const abandon = new AbortController();
  let visibility = null;

  const downgrade = (reason) => {
    if (root.dataset.vfStage === 'poster') return;
    abandon.abort();
    visibility?.disconnect();
    turntable?.dispose();
    turntable = null;
    canvas.remove();
    viewport.classList.remove('is-live');
    disableControls();
    applyTier(1, [reason]);
    root.dataset.vfStage = 'poster';
  };

  try {
    const loading = import('../webgl/turntable.js').then(({ createTurntable }) =>
      createTurntable({
        canvas,
        capture: Boolean(capture),
        signal: abandon.signal,
        onContextLost: () => downgrade('context-lost'),
        onStruggle: () => {
          if (forcedTier !== '2') downgrade('low-fps');
        },
      }),
    );
    loading.catch(() => {});
    turntable = await (capture ? loading : withTimeout(loading, READY_TIMEOUT_MS));
  } catch (error) {
    downgrade(error?.message === 'stage-timeout' ? 'stage-timeout' : 'stage-error');
    return;
  }

  applyTier(2, forcedTier === '2' ? ['forced:2'] : []);
  root.dataset.vfStage = 'live';
  viewport.classList.add('is-live');
  const selected = tabs.find((tab) => tab.getAttribute('aria-pressed') === 'true');
  turntable.setVariant(selected.dataset.variant);

  if (capture) {
    root.classList.add('vf-capture');
    selectVariant(capture);
    turntable.setAngle(32);
    window.__vfCapture = (type, quality) => turntable.capture(type, quality);
    return;
  }

  enableControls();
  onReducedMotion(() => downgrade('reduced-motion'));
  // Only render while the viewer is on screen.
  visibility = new IntersectionObserver(([entry]) => turntable?.setActive(entry.isIntersecting));
  visibility.observe(viewport);
}

function main() {
  initReveals();
  window.addEventListener('vf:motionchange', (event) => {
    if (!event.detail.reduce && root.dataset.vfStage === 'poster') window.location.reload();
  });

  const { tier, reasons } = capture ? { tier: 2, reasons: [] } : detectTier();
  if (tier < 2) {
    applyTier(1, reasons);
    root.dataset.vfStage = 'poster';
    return;
  }
  applyTier(1, ['pending']);
  root.dataset.vfStage = 'loading';
  const whenIdle = () =>
    'requestIdleCallback' in window ? requestIdleCallback(bootTurntable, { timeout: 1200 }) : setTimeout(bootTurntable, 200);
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}

main();
