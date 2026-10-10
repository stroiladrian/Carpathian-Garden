# Carpathian Garden

**Grab power. Grow huge.** A Slither-style growth-and-survival browser game set in a cartoon Romania. Steer a long, segmented political worm, collect money and influence, make your rivals crash into you, and become the biggest creature in the Carpathian Garden.

> Fictional political parody. The four playable politicians are invented archetypes, not depictions of real people. Rivals are computer-controlled AI. There are no online players.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Type-checks and builds to `dist/` |
| `npm run preview` | Serves the production build |
| `npm run typecheck` | TypeScript only |
| `npm run build:single` | Builds a single self-contained `dist-single/index.html` you can open or host anywhere |

The game has no backend, no paid services and no runtime image URLs. All art is drawn on Canvas and all sounds are synthesised with WebAudio. The display fonts come from Google Fonts, and the game falls back to system fonts when offline.

## Play online

Live at **https://stroiladrian.github.io/Carpathian-Garden/**, which redeploys automatically on every push to `main` via GitHub Actions (`.github/workflows/deploy.yml`).

## How to play

| Action | Desktop | Touch |
| --- | --- | --- |
| Steer | Mouse, or `W` `A` `S` `D` / arrow keys | Thumb joystick: touch anywhere on the left 60% of the screen and drag (or switch to *Follow finger* in the menu) |
| Boost (burns mass) | Hold left mouse, `Space` or `Shift` | Hold a second finger anywhere on the right, or hold **BOOST** |
| Special ability | `E`, `Q` or right-click | Tap your portrait button |
| Pause | `P` / `Esc` / ⏸ button | ⏸ button |
| Mute | `M` / 🔊 button | 🔊 button |

If your **head** touches another worm's **body**, you're eliminated. In a head-on collision, the smaller worm loses. The tricolour border is fatal. When a worm is eliminated it spills its war chest as collectibles.

### Collectibles

| Item | Value |
| --- | --- |
| Influence (violet orb) | 1 |
| Campaign Donation (banknote) | 2 |
| Reform Pledge (blue rosette) | 3 |
| Budget Bonus (gold coin) | 4 |
| Public Contract (sealed paper) | 10 |
| Briefcase of Cash | 16 |
| Bribe Envelope | 8, but raises your **Anti-Bribe heat** |
| **Special Contract** (timed, announced) | 40–70 |
| Spilled Funds (from eliminated or boosting worms) | varies |

The capital spawns noticeably more contracts, briefcases and bribes.

### Bribes and the Anti-Bribe Directorate

Each bribe envelope adds about 22 **heat** (the Party Baron gets 30% less). Heat cools off at roughly 2 per second. At 70 you get a warning, and at 100 you're **investigated**: you lose 30% of your power, which spills on the map as confiscated assets, and you're slowed for a moment. AI rivals play by the same rules and lay low when their heat is high.

### Special contracts

Every 35–55 seconds a special contract appears in a village or the capital, for example a No-Bid Motorway Contract, an EU Funds Package or a Hospital That Never Opens. A toast announces it, the minimap marks it, and an arrow at the screen edge points to it. It expires after 30 seconds, and nearby AI rivals race you for it. Tuning lives at the top of `src/game/world.ts` (`HEAT_PER_BRIBE`, `HEAT_DECAY`, `SPECIAL_TTL`, `SPECIAL_CONTRACTS`).

### Politicians

| Archetype | Passive | Ability (cooldown) |
| --- | --- | --- |
| **Tribunul Tunător**, the Firebrand (red/black) | +15% turning | **Thunderous Tirade** (14s): stuns rivals within range for 2s |
| **Magnatul de Aur**, the Golden Tycoon (gold/white) | +30% from coins, notes and gold | **Golden Magnet** (15s): huge pickup radius for 5s |
| **Baronul de Partid**, the Party Baron (red/navy) | +50% from contracts and briefcases | **Fast-Track Procedure** (14s): 4s of free super-speed |
| **Reformistul**, the Earnest Reformer (blue) | Boost costs 40% less; pledges ×3 | **Transparency Shield** (18s): pass through bodies for 3.5s |

Nickname, character, sound setting, touch steering mode and best score are saved in `localStorage`.

### On phones

- Thumb-zone HUD: stats, minimap and leaderboard on top (tap the leaderboard to expand it), with BOOST and ability buttons under your right thumb.
- First run shows a short touch tutorial. Kills, deaths, stuns and abilities trigger haptics on Android.
- **Add to Home Screen** (Safari Share menu / Chrome menu) to play fullscreen like an app. On Android the menu also has a Fullscreen button.
- Rendering resolution drops automatically on devices that can't hold ~45 fps.

## Difficulty

Pick it in the menu: **Intern** (easy), **Candidate** (normal, default) or **Party Baron** (hard). Difficulty only changes the AI rivals; your own growth is never touched. All knobs live in `src/game/difficulty.ts`:

| Knob | What it does | Intern | Candidate | Party Baron |
| --- | --- | --- | --- | --- |
| `aiGrowth` | How much AI gain from each item (1 = same as you) | 0.4 | 0.55 | 1 |
| `aiSoftCap` | AI growth fades to 10% as they approach this power | 450 | 850 | 6000 |
| `aiCapDrain` | Share of power above the cap AI lose per second | 4% | 2.5% | 0 |
| `rubberBand` | AI much bigger than you grow slower; smaller ones a bit faster | on | on | off |
| `aiStartScale` | Size of the opening field | 0.3× | 0.55× | 1× |
| `aggression` | How often AI try to cut you off | 0.35× | 0.7× | 1× |
| `thinkMin/Max` | AI reaction time in seconds | 0.17–0.26 | 0.11–0.18 | 0.08–0.14 |
| `targetPlayerBias` | >1 means AI pick on you less | 1.6 | 1.1 | 0.8 |

To make the game easier overall, lower `aiGrowth` and `aiSoftCap` for Candidate first. Those two change the feel the most.

Progress milestones (titles from Local Councillor to Eternal Leader, the #1 celebration, and the crown over the leader) are in `RANKS` in the same file.

## Architecture

```
src/
  main.ts            boot (waits briefly for fonts)
  app.ts             state machine (menu / playing / paused / gameover), fixed-step loop, camera, events → sound/HUD
  input.ts           mouse / keyboard / touch → ControlInput
  audio.ts           WebAudio synth SFX
  storage.ts         localStorage persistence
  game/              pure simulation: no DOM, no rendering
    config.ts        tunables (speeds, sizes, food counts)
    characters.ts    archetypes, AI names and colours
    worm.ts          Worm entity + ControlInput type
    world.ts         World.step(): steering, movement, boost, abilities, collisions, food, deaths, effects
    grid.ts          counting-sort spatial hash (segments and food)
    food.ts          collectible types and spawning
    ai.ts            AIBrain: goal selection (food / hunt / home) + ray-probe obstacle avoidance
    session.ts       World + controllers + AI respawning
    layout.ts        shared map geography (mountains, rivers, capital, villages)
  render/
    renderer.ts      camera transform, food, worms, ability FX, particles, minimap
    terrain.ts       deterministic illustrated map, rasterised lazily into cached chunks
    heads.ts         vector caricature heads with expressions
    sprites.ts       pre-rendered food and segment bitmaps
  ui/                DOM menu, HUD and leaderboard
```

**Frame-rate independence.** The simulation always advances in fixed 1/60s ticks through an accumulator, and rendering interpolates between the last two ticks. Movement, pickup and collision behave the same at 30, 60 or 144 Hz.

**Ready for multiplayer.** `World` is a pure, deterministic-per-input simulation, and every worm, including the player, is driven by a `ControlInput { angle, boost, ability }`. To add online play:

1. Run `Session`/`World` in a Node.js process (it has no DOM dependencies).
2. Receive each client's `ControlInput` over WebSockets and assign it to that client's worm before each `world.step()`.
3. Broadcast snapshots (worm segments, food deltas, events) at 15–20 Hz, and keep `Renderer` on the client, interpolating between snapshots.

## Tuning

Most balance knobs are in `src/game/config.ts`: arena radius, AI count, food density, speeds, boost cost, and the mass → radius, length and turn-rate curves. Ability numbers live in `characters.ts` and `world.ts#activateAbility`.
