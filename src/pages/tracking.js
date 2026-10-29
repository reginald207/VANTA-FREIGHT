// Tracking page: the simulated tracker. Everything happens in this module and
// the pure simulator; there are no network requests.
import './base.js';
import '../styles/pages/content.css';
import '../styles/pages/forms.css';
import { renderRouteSvg } from '../data/network-svg.js';
import { simulate } from '../tracking/simulator.js';

const form = document.querySelector('.tracker__form');
const fieldset = form.querySelector('fieldset');
const input = form.querySelector('#shipment-id');
const error = form.querySelector('#shipment-id-error');
const status = document.querySelector('.tracker__status');
const result = document.querySelector('.tracker__result');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (value) => String(value).replace(/[&<>"]/g, (char) => ESCAPES[char]);

function showError(message) {
  error.textContent = message;
  error.hidden = false;
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', 'shipment-id-hint shipment-id-error');
  result.hidden = true;
  status.textContent = '';
  input.focus();
}

function clearError() {
  error.hidden = true;
  error.textContent = '';
  input.removeAttribute('aria-invalid');
  input.setAttribute('aria-describedby', 'shipment-id-hint');
}

function renderShipment(shipment) {
  const percent = Math.round(shipment.progress * 100);
  const current = shipment.events.length - 1;
  const facts = [
    ['Service', shipment.service],
    ['Vehicle', `${shipment.vehicle} (fictional)`],
    ['Route', shipment.routeNames.join(' → ')],
    ['Estimated arrival', shipment.eta ? `${shipment.eta} (simulated)` : 'Arrived'],
  ];

  result.innerHTML = `<article class="shipment" aria-labelledby="shipment-title">
  <header class="shipment__head">
    <p class="sim-banner__badge">Simulation</p>
    <h2 id="shipment-title" class="shipment__id">${esc(shipment.id)}</h2>
  </header>
  <p class="shipment__status shipment__status--${shipment.status}">${esc(shipment.statusLabel)}</p>
  <div class="shipment__progress">
    <label for="shipment-progress">Route progress</label>
    <progress id="shipment-progress" max="100" value="${percent}">${percent}%</progress>
    <span aria-hidden="true">${percent}%</span>
  </div>
  <div class="shipment__body">
    <dl class="facts">
      ${facts.map(([term, value]) => `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`).join('')}
    </dl>
    <figure class="route-figure shipment__map">
      ${renderRouteSvg(shipment.route, { id: 'shipment-route' })}
    </figure>
  </div>
  <h3 class="shipment__timeline-title">Timeline</h3>
  <ol class="timeline" role="list">
    ${shipment.events
      .map(
        (event, index) =>
          `<li class="timeline__item"${index === current ? ' aria-current="step"' : ''}>
        <span class="timeline__time">${esc(event.time)}</span>
        <span class="timeline__label">${esc(event.label)}</span>
      </li>`,
      )
      .join('')}
  </ol>
  <p class="content-note">Demo data generated from the ID in your browser. No real shipment, vehicle or location.</p>
</article>`;

  placeTruck(shipment);
  result.hidden = false;
}

// Colour the legs already driven, part-draw the current one, mark the truck.
function placeTruck({ position, status: state }) {
  const svg = result.querySelector('.route-map');
  const legs = [...svg.querySelectorAll('.route-map__leg')];
  legs.forEach((leg, index) => {
    if (index < position.leg || (index === position.leg && position.t >= 1)) return;
    if (index === position.leg) {
      leg.style.strokeDasharray = `${position.t.toFixed(3)} 1`;
    } else {
      leg.classList.add('route-map__leg--ahead');
    }
  });

  const leg = legs[position.leg];
  const point = leg.getPointAtLength(leg.getTotalLength() * Math.min(1, position.t));
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  marker.setAttribute('class', `route-map__marker route-map__marker--${state}`);
  marker.setAttribute('cx', point.x.toFixed(2));
  marker.setAttribute('cy', point.y.toFixed(2));
  marker.setAttribute('r', '2.6');
  svg.append(marker);
}

function track(value, { announce = true } = {}) {
  const outcome = simulate(value);
  if (!outcome.ok) {
    showError(outcome.error);
    return;
  }
  clearError();
  const { shipment } = outcome;
  input.value = shipment.id;
  renderShipment(shipment);

  const url = new URL(window.location.href);
  url.searchParams.set('id', shipment.id);
  window.history.replaceState(null, '', url);

  if (announce) {
    status.textContent = `Simulated result for ${shipment.id}: ${shipment.statusLabel}, ${Math.round(
      shipment.progress * 100,
    )} percent of the route.`;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!input.value.trim()) {
    showError('Enter a shipment ID, for example VF-DEMO-0001.');
    return;
  }
  track(input.value);
});

form.querySelectorAll('[data-demo-id]').forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.dataset.demoId;
    track(input.value);
  });
});

// The form only works with JavaScript, so it ships disabled.
fieldset.disabled = false;

// Deep links (?id=...) from the home page preview run straight away.
const initial = new URLSearchParams(window.location.search).get('id');
if (initial) {
  input.value = initial;
  track(initial, { announce: false });
}
