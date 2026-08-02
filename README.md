# AstroArcade

A retro-pixel arcade of classic games set in deep space. Pure HTML/CSS/JS,
no build step — open `index.html` directly or serve it from any static host.

**Play it live:** https://iihannibalii.github.io/astro-arcade/

## Structure

```
astro-arcade/
├── index.html            # Hub page: starship-console game showcase
├── assets/
│   └── css/
│       ├── theme.css     # Shared theme (arcade-shell): tokens, buttons, badges, starfield
│       └── hub.css       # Hub-page-only styles
└── games/
    ├── breaker/          # AstroBreaker — deflect the orb, smash block waves, catch capsules
    │   ├── index.html
    │   ├── breaker.css
    │   └── js/           # engine.js, sound.js, render.js, main.js
    ├── snake/            # AstroSnake — a star worm gobbles stars, comets are bonus
    │   ├── index.html
    │   ├── snake.css
    │   └── js/           # engine.js, sound.js, render.js, main.js
    ├── sweeper/          # AstroSweeper — minesweeper-style asteroid scan, 3 sector sizes
    │   ├── index.html
    │   ├── sweeper.css
    │   └── js/           # engine.js, sound.js, render.js, main.js
    ├── sudoku/           # AstroSudoku — generated star charts with a unique solution
    │   ├── index.html
    │   ├── sudoku.css
    │   └── js/           # engine.js, sound.js, render.js, main.js
    └── tetris/           # AstroTetris — cosmic blocks, rocket partner, SRS rules
        ├── index.html
        ├── tetris.css
        └── js/
            ├── engine.js # Pure game logic: SRS, 7-bag, gravity, lock delay, scoring
            ├── render.js # Canvas renderer (board, ghost, next, hold, element icons)
            ├── sound.js  # WebAudio synth: 8-bit SFX + original chiptune loop
            ├── mascot.js # Partner rocket: SCOUT → SHUTTLE (Lv.5) → STARSHIP (Lv.10)
            └── main.js   # Input (keys / swipes / taps), game loop, HUD, leaderboard
```

## History

1. ✅ Site skeleton + hub
2. ✅ Tetris engine (canvas, SRS rotation, scoring, levels)
3. ✅ Themed Tetris (element pieces, partner upgrades, WebAudio sound)
4. ✅ Polish: top-5 leaderboard, touch controls + swipe gestures, responsive layout,
   auto-pause on focus loss, board shake on a tetris, favicon
5. ✅ Snake (catch collectibles, timed bonus, leaderboard, touch controls)
6. ✅ Published on GitHub Pages
7. ✅ Full re-theme to an original space setting (was Pokémon-styled)
8. ✅ AI-generated pixel-art backgrounds (local ComfyUI + SDXL): nebula hub,
   alien night for Tetris, comet streaks for Snake
9. ✅ AstroBreaker: breakout-style game with power capsules (wide / slow /
   multiball / extra ship), waves, leaderboard, mouse + touch controls
10. ✅ Puzzle Deck (separate hub section): AstroSweeper — minesweeper-style
    asteroid scanning with beacon mode and per-sector best times
11. ✅ AstroSudoku: generated puzzles with a uniqueness guarantee, pencil
    notes, conflict highlighting, hints with a time penalty

## Principles

- Retro pixel style is the project's look (Press Start 2P, hard pixel borders,
  deep-space playfields, cream console panels) — do not restyle without asking.
- Fully original theme: every sprite, sound and background is made in code.
  No third-party IP, no external assets beyond the pixel font.
- Shared styles live in `assets/` (arcade-shell); each game is a standalone
  module under `games/<name>/`.
- Cache busting: bump the `?v=N` query on CSS/JS links whenever those files change.
