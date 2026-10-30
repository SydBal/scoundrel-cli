'use strict';
// Zero-dependency tests. Run: npm test  (or: node --test test.js)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  valueToNumber, mulberry32, buildDeck, shuffle, newGame,
  canFlee, weaponMitigates, playCard, flee,
} = require('./scoundrel.js');

const card = (suit, label, value) => ({ suit, label, value });

test('deck is the 44-card Scoundrel deck', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 44);
  const bySuit = {};
  for (const c of deck) (bySuit[c.suit] ??= []).push(c.label);
  assert.deepEqual(bySuit.Hearts, ['2', '3', '4', '5', '6', '7', '8', '9', '10']);
  assert.deepEqual(bySuit.Diamonds, ['2', '3', '4', '5', '6', '7', '8', '9', '10']);
  assert.deepEqual(bySuit.Clubs, ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace']);
  assert.deepEqual(bySuit.Spades, ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace']);
});

test('values match the web game: Ace 14, J 11, Q 12, K 13', () => {
  assert.equal(valueToNumber('Ace'), 14);
  assert.equal(valueToNumber('Jack'), 11);
  assert.equal(valueToNumber('Queen'), 12);
  assert.equal(valueToNumber('King'), 13);
  assert.equal(valueToNumber('7'), 7);
});

test('same seed shuffles the same deck', () => {
  const a = shuffle(buildDeck(), mulberry32(42)).map((c) => c.label + c.suit);
  const b = shuffle(buildDeck(), mulberry32(42)).map((c) => c.label + c.suit);
  assert.deepEqual(a, b);
});

test('fresh weapon blocks anything once, then only weaker foes', () => {
  const s = newGame(1);
  s.weapon = card('Diamonds', '5', 5);
  s.freshWeapon = true;
  assert.equal(weaponMitigates(s, 14), true);
  s.room = [card('Spades', 'Ace', 14)];
  playCard(s, 0);
  assert.equal(s.durability, 14);
  assert.equal(s.freshWeapon, false);
  assert.equal(weaponMitigates(s, 13), true);
  assert.equal(weaponMitigates(s, 14), false);
});

test('blocked fight deals monster minus weapon; durability drops to the foe', () => {
  const s = newGame(1);
  s.weapon = card('Diamonds', '7', 7);
  s.freshWeapon = true;
  s.room = [card('Clubs', '10', 10)];
  const hp = s.hp;
  playCard(s, 0);
  assert.equal(s.hp, hp - 3);
  assert.equal(s.durability, 10);
});

test('unblocked fight deals full damage and leaves durability alone', () => {
  const s = newGame(1);
  s.weapon = card('Diamonds', '7', 7);
  s.freshWeapon = false;
  s.durability = 9;
  s.room = [card('Clubs', '10', 10)];
  const hp = s.hp;
  playCard(s, 0);
  assert.equal(s.hp, hp - 10);
  assert.equal(s.durability, 9);
});

test('bare-handed fight deals full damage', () => {
  const s = newGame(1);
  s.room = [card('Spades', '8', 8)];
  playCard(s, 0);
  assert.equal(s.hp, 12);
});

test('hearts heal once per room and cap at 20', () => {
  const s = newGame(1);
  s.hp = 18;
  // Empty deck: no refill between the two hearts, so both are one room.
  s.deck = [];
  s.room = [card('Hearts', '5', 5), card('Hearts', '9', 9), card('Clubs', '2', 2), card('Clubs', '2', 2)];
  playCard(s, 0);
  assert.equal(s.hp, 20);
  assert.equal(s.healedThisRoom, true);
  playCard(s, 0);
  assert.equal(s.hp, 20);
  assert.equal(s.healedThisRoom, true);
});

test('equipping replaces the old weapon and marks it fresh', () => {
  const s = newGame(1);
  s.weapon = card('Diamonds', '4', 4);
  s.freshWeapon = false;
  s.durability = 8;
  s.room = [card('Diamonds', '9', 9)];
  playCard(s, 0);
  assert.equal(s.weapon.value, 9);
  assert.equal(s.freshWeapon, true);
  assert.equal(s.durability, undefined);
});

test('flee only before touching the room and never twice running', () => {
  const s = newGame(1);
  assert.equal(canFlee(s).ok, true);
  flee(s);
  assert.equal(s.fleeCount, 1);
  assert.equal(canFlee(s).ok, false); // fled last room
  // Play a card: flee is locked for this room, but the next room can be fled.
  const idx = s.room.findIndex((c) => c.suit === 'Hearts' || c.suit === 'Diamonds');
  playCard(s, idx >= 0 ? idx : 0);
  assert.equal(canFlee(s).ok, false); // room touched
});

test('flee returns the room to the bottom of the deck', () => {
  const s = newGame(1);
  const roomLabels = s.room.map((c) => c.label + c.suit);
  const deckBefore = s.deck.length;
  flee(s);
  assert.equal(s.deck.length, deckBefore); // 4 out, 4 back in, 4 dealt
  assert.deepEqual(s.deck.slice(-4).map((c) => c.label + c.suit), roomLabels);
});

test('exactly 1 room card left deals 3 more', () => {
  const s = newGame(1);
  s.room = [card('Hearts', '2', 2)];
  s.deck = [card('Clubs', '3', 3), card('Clubs', '4', 4), card('Clubs', '5', 5), card('Clubs', '6', 6)];
  s.hp = 10;
  playCard(s, 0);
  assert.equal(s.room.length, 4);
});

test('refill resets the flee and heal locks (progressRoom semantics)', () => {
  const s = newGame(1);
  s.hp = 10;
  s.room = [
    card('Hearts', '5', 5),
    card('Clubs', '2', 2),
    card('Clubs', '2', 2),
    card('Clubs', '2', 2),
  ];
  s.deck = [card('Clubs', '3', 3), card('Clubs', '4', 4), card('Clubs', '5', 5)];
  playCard(s, 0); // heal, locks the room
  assert.equal(s.hp, 15);
  assert.equal(s.healedThisRoom, true);
  assert.equal(canFlee(s).ok, false);
  playCard(s, 0);
  playCard(s, 0); // third play: 1 card left, refill fires
  assert.equal(s.room.length, 4);
  assert.equal(s.healedThisRoom, false);
  assert.equal(canFlee(s).ok, true);
});

test('flee is available again after a refill, even right after fleeing', () => {
  const s = newGame(1);
  s.room = [card('Clubs', '2', 2), card('Clubs', '2', 2), card('Clubs', '2', 2), card('Clubs', '2', 2)];
  s.deck = [card('Clubs', '3', 3), card('Clubs', '4', 4), card('Clubs', '5', 5)];
  flee(s);
  assert.equal(canFlee(s).ok, false); // fled last room
  playCard(s, 0);
  playCard(s, 0);
  playCard(s, 0); // refill resets the flee lock
  assert.equal(canFlee(s).ok, true);
});

test('a scripted run can win end to end', () => {
  const s = newGame(1);
  s.deck = [card('Hearts', '2', 2), card('Clubs', '2', 2)];
  s.room = [card('Hearts', '2', 2), card('Clubs', '2', 2), card('Diamonds', '2', 2), card('Clubs', '3', 3)];
  playCard(s, 0); // heal 0 at full health
  playCard(s, 0); // fight 2 bare-handed: HP 18
  playCard(s, 0); // equip 2-diamond, fresh
  playCard(s, 0); // fresh weapon blocks the 3: take 1, HP 17
  assert.equal(s.hp, 17);
  playCard(s, 0); // heal 2 after the refill reset: HP 19
  playCard(s, 0); // blocked 2: take 0, room and deck empty
  assert.equal(s.over, true);
  assert.equal(s.won, true);
});

test('death at 0 HP ends the run as a loss', () => {
  const s = newGame(1);
  s.hp = 5;
  s.room = [card('Spades', 'Ace', 14)];
  playCard(s, 0);
  assert.equal(s.over, true);
  assert.equal(s.won, false);
});

test('clearing the last card with an empty deck wins', () => {
  const s = newGame(1);
  s.deck = [];
  s.room = [card('Hearts', '2', 2)];
  playCard(s, 0);
  assert.equal(s.over, true);
  assert.equal(s.won, true);
});

// A dumb-but-legal autoplay policy must always terminate the run.
// (Greedy policies lose Scoundrel badly; winnability is covered by the
// scripted win test above, not by win rate here.)
function autoplay(seed) {
  const s = newGame(seed);
  let steps = 0;
  while (!s.over && steps++ < 500) {
    if (canFlee(s).ok && s.room.every((c) => c.suit === 'Clubs' || c.suit === 'Spades') && s.hp < 12) {
      flee(s);
      continue;
    }
    // Prefer: heal when hurt, equip, then the weakest fightable monster.
    let idx = s.room.findIndex((c) => c.suit === 'Hearts' && !s.healedThisRoom && s.hp < s.maxHp);
    if (idx < 0) idx = s.room.findIndex((c) => c.suit === 'Diamonds');
    if (idx < 0) {
      let best = Infinity;
      s.room.forEach((c, i) => {
        if ((c.suit === 'Clubs' || c.suit === 'Spades') && c.value < best) { best = c.value; idx = i; }
      });
    }
    if (idx < 0) idx = 0;
    playCard(s, idx);
  }
  return s;
}

test('autoplayed runs always terminate, win or lose', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const s = autoplay(seed);
    assert.equal(s.over, true, `seed ${seed} did not terminate`);
  }
});
