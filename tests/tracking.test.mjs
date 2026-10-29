// Unit tests for the simulated tracker and the demo form's validation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { localToday, validateRequest } from '../src/forms/validate.js';
import { HUBS } from '../src/data/network.js';
import { findLane } from '../src/data/network-svg.js';
import { DEMO_IDS, findRoute, formatClock, isValidId, normaliseId, simulate } from '../src/tracking/simulator.js';

const hubIds = new Set(HUBS.map((hub) => hub.id));

describe('shipment IDs', () => {
  test('are normalised: trimmed, upper-cased, spaces removed', () => {
    assert.equal(normaliseId('  vf-demo- 0001 '), 'VF-DEMO-0001');
  });

  test('valid and invalid formats', () => {
    for (const id of ['VF-DEMO-0001', 'vf-7k2p9q', 'VF-AB', 'VF-AB-CD-EF']) assert.ok(isValidId(id), id);
    for (const id of ['', 'VF-', 'VF-A', 'XX-DEMO-0001', 'VF-DEMO-0001-AB-CD', 'VF_DEMO', 'VF-<script>', 'VF-ABCDEFGHI'])
      assert.ok(!isValidId(id), id);
  });

  test('invalid IDs get a helpful error, never a result', () => {
    const outcome = simulate('nope');
    assert.equal(outcome.ok, false);
    assert.match(outcome.error, /VF-DEMO-0001/);
  });
});

describe('simulate', () => {
  const sample = Array.from({ length: 300 }, (_, i) => `VF-T${i.toString(36).toUpperCase().padStart(2, '0')}`);

  test('is deterministic: the same ID always tells the same story', () => {
    for (const id of [...DEMO_IDS, ...sample.slice(0, 50)]) assert.deepEqual(simulate(id), simulate(id.toLowerCase()));
  });

  test('never reads the real clock or the network', () => {
    const source = readFileSync(new URL('../src/tracking/simulator.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bDate\b|performance\.now|fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  });

  test('routes use fictional hubs and follow real lanes', () => {
    for (const id of [...DEMO_IDS, ...sample]) {
      const { shipment } = simulate(id);
      assert.ok(shipment.route.length >= 2, id);
      shipment.route.forEach((hub) => assert.ok(hubIds.has(hub), `${id}: ${hub}`));
      shipment.route.slice(1).forEach((to, i) => assert.doesNotThrow(() => findLane(shipment.route[i], to)));
    }
  });

  test('timelines are in order, progress is bounded and the ETA matches the status', () => {
    for (const id of [...DEMO_IDS, ...sample]) {
      const { shipment } = simulate(id);
      assert.equal(shipment.simulated, true);
      assert.ok(shipment.progress > 0 && shipment.progress <= 1, `${id} progress ${shipment.progress}`);
      shipment.events.slice(1).forEach((event, i) => assert.ok(event.at >= shipment.events[i].at, `${id} order`));
      assert.equal(shipment.eta === null, shipment.status === 'delivered', id);
      assert.ok(shipment.position.t >= 0 && shipment.position.t <= 1);
      assert.ok(shipment.position.leg >= 0 && shipment.position.leg < shipment.route.length - 1);
    }
  });

  test('generated IDs cover every status', () => {
    const statuses = new Set(sample.map((id) => simulate(id).shipment.status));
    assert.deepEqual([...statuses].sort(), ['at-hub', 'delivered', 'in-transit']);
  });

  test('the three demo IDs tell three different stories', () => {
    const [a, b, c] = DEMO_IDS.map((id) => simulate(id).shipment);
    assert.equal(a.status, 'in-transit');
    assert.equal(b.status, 'delivered');
    assert.equal(c.status, 'at-hub');
  });

  test('VF-DEMO-0001 matches the preview card on the home page', () => {
    const { shipment } = simulate('VF-DEMO-0001');
    const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(home, new RegExp(`${Math.round(shipment.progress * 100)} percent`));
    assert.match(home, new RegExp(`--value: ${shipment.progress}`));
    shipment.events.slice(-3).forEach((event) => {
      assert.ok(home.includes(event.time), `home shows ${event.time}`);
      assert.ok(home.includes(event.label), `home shows "${event.label}"`);
    });
  });

  test('story clock formatting rolls over days', () => {
    assert.equal(formatClock(370), 'Day 1 · 06:10');
    assert.equal(formatClock(1440 + 5), 'Day 2 · 00:05');
  });

  test('route finding follows lanes and returns null for unknown hubs', () => {
    assert.deepEqual(findRoute('northgate', 'kestrel'), ['northgate', 'kestrel']);
    assert.equal(findRoute('northgate', 'atlantis'), null);
  });
});

describe('validateRequest', () => {
  const today = '2026-10-29';
  const quote = {
    type: 'quote',
    service: 'linehaul',
    origin: 'ironvale',
    destination: 'merrow',
    readyDate: '2026-11-02',
    pallets: '12',
    name: 'Ada Example',
    email: 'ada@example.com',
  };

  test('a complete quote passes', () => {
    assert.deepEqual(validateRequest(quote, { today }), {});
  });

  test('a question needs a message but no load details', () => {
    const question = { type: 'question', name: 'Ada', email: 'ada@example.com' };
    assert.deepEqual(Object.keys(validateRequest(question, { today })), ['message']);
    assert.deepEqual(validateRequest({ ...question, message: 'Hello' }, { today }), {});
  });

  test('every field explains what to fix', () => {
    const cases = [
      [{ type: '' }, 'type', /quote or have a question/],
      [{ service: '' }, 'service', /Choose a service/],
      [{ destination: 'ironvale' }, 'destination', /different from the origin/],
      [{ readyDate: '2026-02-31' }, 'readyDate', /real date/],
      [{ readyDate: '2026-10-28' }, 'readyDate', /in the past/],
      [{ pallets: '0' }, 'pallets', /from 1 to 33/],
      [{ pallets: '2.5' }, 'pallets', /whole number/],
      [{ pallets: '34' }, 'pallets', /from 1 to 33/],
      [{ name: ' ' }, 'name', /Enter your name/],
      [{ name: 'x'.repeat(81) }, 'name', /80 characters/],
      [{ email: 'ada@example' }, 'email', /name@example\.com/],
      [{ email: 'ada example@x.io' }, 'email', /name@example\.com/],
      [{ message: 'x'.repeat(1001) }, 'message', /1,000 characters/],
    ];
    for (const [change, field, message] of cases) {
      const errors = validateRequest({ ...quote, ...change }, { today });
      assert.match(errors[field] ?? '', message, JSON.stringify(change));
    }
  });

  test('today is a valid ready date', () => {
    assert.deepEqual(validateRequest({ ...quote, readyDate: today }, { today }), {});
  });

  test('localToday formats the local date', () => {
    assert.equal(localToday(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  });
});
