import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseNextClimate, planCycle } from '../assets/contact/stillflow/scene-scheduler.js';
import { seededRandom } from '../assets/contact/stillflow/timeline.js';

const climates = ['rainy', 'overcast', 'sunny', 'golden', 'night'];

test('scheduler never selects the active climate when another is available', () => {
  for (const current of climates) {
    const next = chooseNextClimate(current, climates, () => 0);
    assert.ok(climates.includes(next));
    assert.notEqual(next, current);
  }
});

test('a seeded cycle plan reproduces its hold, event eligibility and next climate', () => {
  const first = planCycle({ stateId: 'rainy', states: climates, random: seededRandom(17), minHold: 900, maxHold: 1400, eventStates: ['rainy'] });
  const second = planCycle({ stateId: 'rainy', states: climates, random: seededRandom(17), minHold: 900, maxHold: 1400, eventStates: ['rainy'] });
  assert.deepEqual(first, second);
  assert.equal(first.pedestrian, true);
  assert.ok(first.hold >= 900 && first.hold <= 1400);
  assert.ok(climates.includes(first.nextState));
  assert.notEqual(first.nextState, 'rainy');
});

test('the runtime can exclude event climates when no photographic pass is approved', () => {
  const rainy = planCycle({ stateId: 'rainy', states: climates, random: seededRandom(17), minHold: 10, maxHold: 10 });
  assert.equal(rainy.pedestrian, false, 'no event is registered by default');
});

test('pedestrian events can be registered only for their approved climates', () => {
  for (const stateId of ['sunny', 'golden', 'night']) {
    const cycle = planCycle({ stateId, states: climates, random: () => 0, minHold: 10, maxHold: 10, eventStates: ['rainy', 'overcast'] });
    assert.equal(cycle.pedestrian, false, `${stateId} must not show the rainy-blue-hour pedestrian pass`);
  }
});

test('single-state manifests do not schedule a climate transition', () => {
  assert.equal(chooseNextClimate('rainy', ['rainy'], () => 0), null);
});
