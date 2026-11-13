# Addis Runner

Endless runner (Temple Run style) down a real Addis Ababa route: Sidist Kilo, Arat Kilo, Meskel Square, Bole Medhanialem, Bole Airport (about 9 km, loops).
No dependencies; plain canvas, works on a phone browser or in a WebView.

## Run
`npm start` then open http://localhost:5173 (ES modules need a server). `npm test` checks the route maths.
Controls: arrows / WASD / Space, or swipe.

## How the city is used
- `src/route.js` turns a list of GPS points into the track: one segment per 25 m, and the change of heading becomes the curve of the road, so real bends are bends in the game.
- The built-in landmark coordinates are **approximate**. For the real road geometry run `npm run fetch-route` (needs internet): it snaps the route to OpenStreetMap roads through OSRM and writes `data/route.json`, which the game then loads. Map data (c) OpenStreetMap contributors, ODbL: keep the attribution if you publish.
- Districts change the look: old city (low warm buildings), city centre, Bole (tall glass). Kerbs use the Ethiopian flag colours.
- Hazards: blue-and-white minibus taxis (change lane), goats (jump), LRT bridges (slide). Coins are birr.

## Not done yet
- Real building footprints and heights (needs an OpenStreetMap buildings pass), more landmarks, sound, Amharic UI.
- Not yet play-tested on a device: tune speeds and hit-boxes before release.
