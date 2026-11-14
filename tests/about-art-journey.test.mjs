import test from 'node:test';
import assert from 'node:assert/strict';
import { journeyState } from '../src/components/about/art/journey-state.ts';

test('the three complete screens occupy the start, midpoint and end', () => {
  const music = journeyState(100, 100, 800);
  const art = journeyState(500, 100, 800);
  const games = journeyState(900, 100, 800);
  assert.equal(music.chapter, 'music'); assert.equal(music.presence, 0);
  assert.equal(art.chapter, 'art'); assert.equal(art.presence, 1);
  assert.equal(games.chapter, 'games'); assert.equal(games.presence, 0);
});
test('Art stays fully formed across the reading window', () => {
  for (const progress of [.4, .5, .6]) {
    assert.equal(journeyState(100 + 800 * progress, 100, 800).presence, 1);
  }
});
test('entry and exit form the same amount of Art from opposite origins', () => {
  const entry = journeyState(100 + 800 * .26, 100, 800);
  const exit = journeyState(100 + 800 * .74, 100, 800);
  assert.equal(entry.presence, exit.presence);
  assert.equal(entry.entering, true); assert.equal(exit.entering, false);
  assert.equal(entry.depth, -exit.depth);
});
test('visual chapters and interactive panels change at separate boundaries', () => {
  assert.equal(journeyState(100 + 800 * .3, 100, 800).chapter, 'art');
  assert.equal(journeyState(100 + 800 * .3, 100, 800).interactiveChapter, 'music');
  assert.equal(journeyState(100 + 800 * .7, 100, 800).interactiveChapter, 'art');
  assert.equal(journeyState(100 + 800 * .9, 100, 800).interactiveChapter, 'games');
});
test('reverse scroll and jumps reconstruct the same state without accumulated history', () => {
  const first = journeyState(325, 100, 800);
  journeyState(900, 100, 800);
  assert.deepEqual(journeyState(325, 100, 800), first);
  assert.equal(journeyState(-1000, 100, 800).progress, 0);
  assert.equal(journeyState(5000, 100, 800).progress, 1);
});
