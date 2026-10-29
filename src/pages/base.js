// Shared entry for every page: fonts, tokens, base styles, navigation.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono';
import '../styles/tokens.css';
import '../styles/base.css';

function initNavToggle() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

initNavToggle();
