// Validation for the demo quote and contact form. Pure: takes plain values,
// returns { field: message } for every problem, in form order. Messages say
// what to do, not just what is wrong.

export const LIMITS = { pallets: { min: 1, max: 33 }, name: 80, message: 1000 };

// Pragmatic email check: something@something.tld, no spaces.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(value) {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject dates like 2026-02-31 that roll over into the next month.
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/**
 * @param {Record<string, string>} values  Field values keyed by field name.
 * @param {{today: string}} context        Today's date as YYYY-MM-DD.
 * @returns {Record<string, string>}        Error messages keyed by field name.
 */
export function validateRequest(values, { today }) {
  const v = (name) => String(values[name] ?? '').trim();
  const errors = {};

  if (!['quote', 'question'].includes(v('type'))) {
    errors.type = 'Choose whether you want a quote or have a question.';
  }

  if (v('type') === 'quote') {
    if (!v('service')) errors.service = 'Choose a service.';
    if (!v('origin')) errors.origin = 'Choose where the load starts.';
    if (!v('destination')) errors.destination = 'Choose where the load is going.';
    else if (v('destination') === v('origin')) errors.destination = 'Choose a destination that is different from the origin.';

    const ready = parseDate(v('readyDate'));
    if (!v('readyDate')) errors.readyDate = 'Enter the date the load will be ready.';
    else if (!ready) errors.readyDate = 'Enter a real date, for example 2026-11-20.';
    else if (ready < parseDate(today)) errors.readyDate = 'The ready date cannot be in the past.';

    const pallets = Number(v('pallets'));
    if (!v('pallets')) errors.pallets = 'Enter how many pallets you are sending.';
    else if (!Number.isInteger(pallets) || pallets < LIMITS.pallets.min || pallets > LIMITS.pallets.max) {
      errors.pallets = `Enter a whole number of pallets from ${LIMITS.pallets.min} to ${LIMITS.pallets.max}.`;
    }
  }

  if (!v('name')) errors.name = 'Enter your name.';
  else if (v('name').length > LIMITS.name) errors.name = `Keep your name to ${LIMITS.name} characters or fewer.`;

  if (!v('email')) errors.email = 'Enter your email address.';
  else if (!EMAIL.test(v('email'))) errors.email = 'Enter an email address like name@example.com.';

  if (v('type') === 'question' && !v('message')) errors.message = 'Enter your question.';
  else if (v('message').length > LIMITS.message) {
    errors.message = `Keep your message to ${LIMITS.message.toLocaleString('en')} characters or fewer.`;
  }

  return errors;
}

// Today's date as YYYY-MM-DD in the visitor's own time zone.
export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
