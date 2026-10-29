// Contact page: the demo request form. It validates in the browser and then
// shows what would have been sent. There is no network request and nothing is
// stored; the form is reset as soon as it succeeds.
import './base.js';
import '../styles/pages/content.css';
import '../styles/pages/forms.css';
import { localToday, validateRequest } from '../forms/validate.js';

const form = document.querySelector('.request__form');
const all = form.querySelector('.request__all');
const quote = form.querySelector('.request__quote');
const summary = document.querySelector('.error-summary');
const summaryList = summary.querySelector('.error-summary__list');
const done = document.querySelector('.request__done');

// Field order for the error summary, and labels for the confirmation.
const FIELDS = {
  type: 'What you need',
  service: 'Service',
  origin: 'From',
  destination: 'To',
  readyDate: 'Ready date',
  pallets: 'Pallets',
  temperature: 'Temperature',
  name: 'Name',
  email: 'Email',
  company: 'Company',
  message: 'Message',
};

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (value) => String(value).replace(/[&<>"]/g, (char) => ESCAPES[char]);

// The element to focus or link to for a field.
const target = (name) => (name === 'type' ? form.querySelector('#type-quote') : form.elements[name]);

function syncType() {
  const isQuote = form.elements.type.value === 'quote';
  // A disabled fieldset is skipped by FormData and by validation.
  quote.disabled = !isQuote;
  quote.hidden = !isQuote;
}

function clearErrors() {
  summary.hidden = true;
  summaryList.replaceChildren();
  form.querySelectorAll('.field__error').forEach((el) => {
    el.hidden = true;
    el.textContent = '';
  });
  form.querySelectorAll('[aria-invalid]').forEach((el) => {
    el.removeAttribute('aria-invalid');
    el.setAttribute('aria-describedby', el.dataset.describedby ?? '');
    if (!el.getAttribute('aria-describedby')) el.removeAttribute('aria-describedby');
  });
  form.querySelectorAll('.field.has-error').forEach((el) => el.classList.remove('has-error'));
}

function showErrors(errors) {
  Object.entries(errors).forEach(([name, message]) => {
    const error = document.getElementById(`${name}-error`);
    error.textContent = message;
    error.hidden = false;
    document.getElementById(`field-${name}`)?.classList.add('has-error');

    const control = name === 'type' ? null : form.elements[name];
    if (control) {
      control.dataset.describedby ??= control.getAttribute('aria-describedby') ?? '';
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', `${control.dataset.describedby} ${name}-error`.trim());
    }

    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${target(name).id}`;
    link.textContent = message;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      target(name).focus();
    });
    item.append(link);
    summaryList.append(item);
  });
  summary.hidden = false;
  summary.focus();
}

function describe(name, value) {
  const control = form.elements[name];
  if (control?.tagName === 'SELECT') return control.selectedOptions[0]?.textContent ?? value;
  if (name === 'type') return value === 'quote' ? 'A quote for a load' : 'Help with a question';
  return value;
}

function showDone(values) {
  const rows = Object.keys(FIELDS)
    .filter((name) => values[name])
    .map((name) => `<div><dt>${esc(FIELDS[name])}</dt><dd>${esc(describe(name, values[name]))}</dd></div>`)
    .join('');
  done.querySelector('.request__summary').innerHTML = rows;
  form.reset();
  syncType();
  form.hidden = true;
  done.hidden = false;
  done.focus();
}

form.addEventListener('change', (event) => {
  if (event.target.name === 'type') syncType();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearErrors();
  const values = Object.fromEntries(new FormData(form));
  const errors = validateRequest(values, { today: localToday() });
  if (Object.keys(errors).length) {
    // Show problems in the order the fields appear on the page.
    const ordered = Object.fromEntries(Object.keys(FIELDS).filter((n) => errors[n]).map((n) => [n, errors[n]]));
    showErrors(ordered);
    return;
  }
  showDone(values);
});

done.querySelector('[data-restart]').addEventListener('click', () => {
  done.hidden = true;
  done.querySelector('.request__summary').replaceChildren();
  form.hidden = false;
  target('type').focus();
});

// Prefill the service from a service page's "Request a quote" link.
const service = new URLSearchParams(window.location.search).get('service');
if (service && [...form.elements.service.options].some((option) => option.value === service)) {
  form.elements.service.value = service;
}
form.elements.readyDate.min = localToday();

// The form only works with JavaScript, so it ships disabled.
all.disabled = false;
syncType();
