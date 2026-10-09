# Specialty Up

A Heads Up-style party game for our Specialty Lines team. Hold the phone sideways on your forehead with the screen facing out, and your teammates act out or describe the word.

- Nod down (screen toward the floor) = correct
- Tilt back (screen toward the ceiling) = pass

Runs as a static site with no server or accounts. It works in iPhone Safari and Android Chrome, and decks are saved on the phone.

## Playing

Open the site, pick a deck and tap **Play**. On iPhone, allow motion access when asked. The round starts once the phone is held sideways and still on your forehead.

For a full screen game that also works offline, use Add to Home Screen from the browser's share menu.

If the gestures feel off, open **Settings** to change how far you have to tilt, or to swap correct and pass. The [sensor test page](sensor-test.html) shows live sensor readings.

## Decks

- **New deck**: a name and one card per line. Pasting a list works.
- **Import file**: `.json` (a deck exported from this game), or `.txt` / `.csv` with one card per line.
- **Share link**: puts the whole deck in a link, so it opens on another phone.
- **Export file**: downloads the deck as `.json` as a backup.

Clearing the browser's site data also deletes your decks, so export the ones you care about.

## Hosting

Motion sensors only work on `https` pages. GitHub Pages provides that: go to Settings → Pages and choose Deploy from a branch, `main`, `/ (root)`.

## Development

There is no build step. Serve the folder and open it:

```sh
npx http-server -c-1 -p 8080 .
```

- `node --test` runs the gesture detection tests.
- `node tests/e2e.mjs` plays full rounds in a headless browser with fake sensor data (needs Playwright and the server above).

| File | What it does |
| --- | --- |
| `js/motion.js` | Motion permission, sensor smoothing, nod and tilt detection |
| `js/game.js` | Card order, timer, score |
| `js/decks.js` | Saving, import/export, share links |
| `js/app.js` | Screens and game flow |
| `js/builtin-decks.js` | The built-in test deck |
