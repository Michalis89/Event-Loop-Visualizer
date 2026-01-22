# Event Loop Visualizer

An interactive, step-by-step visualizer for the JavaScript event loop. It supports a beginner-friendly toy syntax and a real Custom JS mode that captures runtime scheduling so you can replay what happened in the same UI.

## What This Teaches

- How sync code runs before any queued work
- Why microtasks (Promises/queueMicrotask) run before tasks (setTimeout)
- How the event loop alternates: sync → microtasks → one task → microtasks → ...

## Modes

### 1) Toy Syntax (Beginner)
Write simplified code like:

```
log("Start")
then("Promise.then")
timeout("Timeout 0ms")
log("End")
```

Supported commands:
- `log("text")`
- `then("text")`
- `timeout("text")`
- `await("text")`
- `async { ... }`

Use **Compile** to parse and then **Step** or **Auto** to replay.

### 2) Custom JS (Advanced)
Write real JavaScript. On Step/Analyze, the app captures runtime scheduling of:
- `setTimeout`
- `queueMicrotask`
- `Promise.resolve().then(...)`
- `async/await`
- `setImmediate` (polyfilled in browser)

The capture is replayed in the same queues, narrator, and console panels.

## How To Use

1. Choose a mode from the dropdown.
2. If Toy mode: select a preset (optional) and click **Compile**.
3. Click **Step** to advance one unit of work or **Auto** to play.
4. Use **Analyze Code** for a generated explanation of the flow.

## Run Locally (No Build)

This project uses ES modules, so it must be served by a local web server (not `file://`).

Example options:

```
# Python
python -m http.server

# Node (if you have it)
npx serve
```

Then open `http://localhost:8000` (or the port shown).

## File Structure

```
index.html
styles.css
scripts/
  main.js        # app bootstrap + UI wiring
  dom.js         # DOM helpers
  state.js       # shared state
  render.js      # UI rendering
  narrator.js    # narrator + console log helpers
  ui.js          # reset/auto helpers
  presets.js     # toy presets
  toy.js         # toy compiler + execution
  custom.js      # custom JS capture + replay
  analysis.js    # analysis generators
```

## Notes & Limitations

- Custom JS analysis is **best-effort**: it captures scheduling of specific APIs, not full JS parsing.
- Very long timers may not appear in the replay (capture waits ~2.5s).

## Deploy

You can deploy directly to Vercel/Netlify/GitHub Pages as a static site. No build step needed.
