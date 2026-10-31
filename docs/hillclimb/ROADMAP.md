# Hill Climb Racer - upgrade roadmap

Nine phases, one push (branch) per phase, reviewed before the next starts. Feature images for every phase are
rendered from the game's own painters by `tools/hillclimb_showcase.py` into `docs/hillclimb/phaseN/`.

| # | Phase | Status |
|---|-------|--------|
| 1 | **Car designs, bridges and obstacles** (detailed painters for sports / pickup / police / monster, 4 bridge styles, 6 new obstacles) | done - this branch |
| 2 | Car selection - garage cards, skins per model, stat/price polish, remaining model art |  |
| 3 | Bike selection - sport, dirt, adventure, chopper, futuristic: detail pass like the cars |  |
| 4 | Driver selection - characters, outfits, abilities, portraits |  |
| 5 | Planet selection - Earth, desert, ice, volcanic, jungle, alien: world data, physics feel, tints |  |
| 6 | Landscape selection - mountains, forests, deserts, cities, waterfalls, space + remaining environment props (trees, rocks, buildings) |  |
| 7 | Vehicle animations - idle, driving, jumping, landing, crashing |  |
| 8 | Collectibles - coins, diamonds, fuel, trophies, rewards |  |
| 9 | Game interface - garage, upgrades, level select, HUD |  |

## Phase 1 - what changed

Files (all under `public/games/hillclimb-racing/`):

- `cars.js` (new) - replaces the flat painters for **Lightning GT**, **Dune Hauler**, **Patrol Cruiser**, **Crimson Crusher**:
  glossy shaded paint, panel gaps, door handles and mirrors, chrome, glowing lamps, flared wheel arches, and per-car detail
  (GT wing / side scoop / hood vents, pickup bed liner + sport bar + running board, police livery / badge / push bar / antenna,
  monster coil-over shocks / exhaust stacks / roll cage light bar / mud). Silhouettes, windshield anchors and driver
  positions are unchanged, so physics and rider placement are identical. Stats, prices and Jeep skins are untouched.
- `bridges.js` (new) - one bridge style per world, all drawn over the same physics deck so driving is identical:
  Green Hills stone arch (keystones, moss, lanterns) - Desert timber trestle (planks, braced piers, rail posts, pennants) -
  Snow stone arch (snow caps, icicles) - Night steel truss (girders, rivets, X-braced legs, hanging lamps).
- `props.js` - six new obstacles: **tire stack**, **rock pile**, **concrete barrier** (solid bumps the wheels climb),
  **striped barricade**, **hay bale**, **sandbag wall** (smashable, slow the car).
- `index.html` - loads the two new scripts, registers the obstacles (`OBSK`), per-world spawn mix (`OMIX`), smash effects
  for barricade / hay, and calls `drawBridgeFor` instead of `drawBridge`.

Not changed in Phase 1: the Jeep (image based), the garage card photos in `sel/` (these are separate artwork), bikes, drivers.

Spawn mix per world: Green Hills = hay, tires, barricades; Desert = rock piles, sandbags; Snow = barriers, tires, barricades;
Night = barricades, barriers, tires.
