# Scoundrel CLI

Scoundrel, the single-player roguelike card game, played in the terminal. The same rules as [Classic Scoundrel](https://classicscoundrel.com), stripped down to text: no graphics, no build step, no dependencies.

## Play

```sh
node scoundrel.js
```

Optional reproducible shuffle:

```sh
node scoundrel.js --seed 42
```

## Commands

| Key | Action |
| --- | ------ |
| `1`–`4` | Play that room card |
| `f` | Flee the room |
| `h` | Help |
| `q` | Quit |

## Rules

- You have 20 HP (max 20). Clear all 44 cards to win. Hit 0 HP and you lose.
- The deck: Hearts 2–10, Diamonds 2–10, Clubs 2–Ace, Spades 2–Ace. Aces are 14, Jacks 11, Queens 12, Kings 13.
- Rooms of 4 face-up cards. After you resolve a card, if exactly 1 room card remains, 3 more are dealt. Each refill is a fresh room: healing and flee unlock again, even right after a flee. (This matches `progressRoom` in the web game; without the reset, exhaustive search shows the game is effectively unwinnable.)
- **Hearts** heal, but only once per room, and never above 20 HP. A second heart in the same room does nothing.
- **Diamonds** equip as your weapon. A fresh weapon blocks any one monster. After that, the weapon only blocks monsters weaker than the last monster it slew (its durability becomes that monster's value). Blocked damage is the monster's value minus the weapon's value, never below 0. A fight the weapon cannot block deals full damage and leaves durability unchanged. Equipping a new weapon discards the old one.
- **Clubs and Spades** are monsters. Fight them bare-handed for full damage, or with a weapon when it blocks.
- **Flee** (`f`) only works before you touch a room, and never on two rooms in a row. Fleeing returns the room to the bottom of the deck and redeals. Playing any card locks flee for the rest of the room.

## Tests

```sh
npm test
```

The suite covers the deck, fight math, healing, equipping, flee rules, room refills, win/lose, and 50 auto-played runs that must all terminate.
