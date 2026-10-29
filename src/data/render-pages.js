// Build-time HTML for the data-driven pages (see plugins/html-partials.js).
// One template renders every service page; the index, fleet and credits
// sections come from the same data modules the tests check.
import { CREDITS } from './credits.js';
import { FLEET } from './fleet.js';
import { hubById } from './network.js';
import { renderRouteSvg } from './network-svg.js';
import { SERVICES, serviceBySlug } from './services.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (value) => String(value).replace(/[&<>"]/g, (char) => ESCAPES[char]);

const routeNames = (route) => route.map((id) => hubById(id).name);

export function renderServiceHead(slug) {
  const service = serviceBySlug(slug);
  return `<title>${esc(service.name)} · Services · VANTA FREIGHT</title>
    <meta name="description" content="${esc(service.summary)} VANTA FREIGHT is a fictional carrier." />`;
}

function serviceCard(service, headingLevel = 2) {
  return `<a class="service-card" href="/services/${service.slug}/">
  <span class="service-card__index" aria-hidden="true">${service.index}</span>
  <h${headingLevel} class="service-card__title">${esc(service.name)}</h${headingLevel}>
  <span class="service-card__tagline">${esc(service.tagline)}</span>
  <span class="service-card__route">${routeNames(service.route).map(esc).join(' → ')}</span>
  <span class="service-card__more" aria-hidden="true">See how it works</span>
</a>`;
}

export function renderServicesIndex() {
  return `<ul class="service-grid" role="list">
${SERVICES.map((service) => `<li data-reveal>${serviceCard(service)}</li>`).join('\n')}
</ul>`;
}

export function renderServicePage(slug) {
  const service = serviceBySlug(slug);
  const names = routeNames(service.route);
  const others = SERVICES.filter((other) => other.slug !== slug);
  const list = (items) => items.map((item) => `<li>${esc(item)}</li>`).join('');

  return `<main id="main" tabindex="-1" class="content">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol role="list">
      <li><a href="/services/">Services</a></li>
      <li><span aria-current="page">${esc(service.name)}</span></li>
    </ol>
  </nav>

  <header class="content-hero">
    <p class="eyebrow eyebrow--lime">Service ${service.index}</p>
    <h1>${esc(service.name)}</h1>
    <p class="content-hero__lede">${esc(service.tagline)}</p>
    <p class="content-hero__summary">${esc(service.summary)}</p>
    <div class="hero__actions">
      <a class="btn btn--primary" href="/contact/">Request a quote <span class="btn__tag">Demo</span></a>
      <a class="btn btn--ghost" href="/tracking/">Track a shipment <span class="btn__tag">Simulated</span></a>
    </div>
  </header>

  <section class="content-section content-section--split" aria-labelledby="route-title">
    <div class="content-section__copy">
      <h2 id="route-title">An example run</h2>
      <p>${names.map(esc).join(' to ')}, on the illustrative network.</p>
      <dl class="facts">
        ${service.facts.map(([term, value]) => `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`).join('')}
      </dl>
      <p class="content-note">Fictional hubs on an abstract map. Not real geography.</p>
    </div>
    <figure class="route-figure" data-reveal>
      ${renderRouteSvg(service.route, { id: `route-${service.slug}` })}
    </figure>
  </section>

  <section class="content-section content-section--split" aria-labelledby="included-title">
    <div class="content-section__copy">
      <h2 id="included-title">What’s included</h2>
      <ul class="checklist" role="list">${list(service.included)}</ul>
    </div>
    <div class="content-section__copy">
      <h2 id="fit-title">A good fit for</h2>
      <ul class="checklist checklist--plain" role="list">${list(service.fit)}</ul>
    </div>
  </section>

  <section class="content-section" aria-labelledby="steps-title">
    <h2 id="steps-title">How a run works</h2>
    <ol class="steps" role="list">
      ${service.steps
        .map(
          ([title, copy], index) => `<li class="steps__item" data-reveal>
        <span class="steps__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
        <h3 class="steps__title">${esc(title)}</h3>
        <p>${esc(copy)}</p>
      </li>`,
        )
        .join('')}
    </ol>
  </section>

  <section class="content-section" aria-labelledby="related-title">
    <h2 id="related-title">Other services</h2>
    <ul class="service-grid service-grid--compact" role="list">
      ${others.map((other) => `<li>${serviceCard(other, 3)}</li>`).join('')}
    </ul>
  </section>

  <p class="content-disclaimer" role="note">
    VANTA FREIGHT is a fictional company. This page describes how a carrier like it could work. It is not an offer.
  </p>
</main>`;
}

export function renderFleetClasses() {
  return `<ul class="fleet-grid" role="list">
${FLEET.map(
  (vehicle) => `<li class="fleet-card" id="${vehicle.code.toLowerCase()}" data-reveal>
  <p class="fleet-card__code">${vehicle.code}</p>
  <h3 class="fleet-card__name">${esc(vehicle.name)}</h3>
  <p class="fleet-card__use">${esc(vehicle.use)}</p>
  <dl class="facts facts--grid">
    ${vehicle.specs.map(([term, value]) => `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`).join('')}
  </dl>
</li>`,
).join('\n')}
</ul>`;
}

export function renderCredits() {
  const rows = CREDITS.map((credit) => {
    const license = credit.licenseUrl
      ? `<a href="${esc(credit.licenseUrl)}" rel="noopener">${esc(credit.license)}</a>`
      : esc(credit.license);
    return `<tr><th scope="row">${esc(credit.name)}</th><td>${esc(credit.use)}</td><td>${license}</td></tr>`;
  }).join('\n');
  return `<div class="table-scroll" tabindex="0" role="region" aria-labelledby="credits-title">
<table class="credits-table">
  <thead><tr><th scope="col">Work</th><th scope="col">Used for</th><th scope="col">Licence</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
</div>`;
}
