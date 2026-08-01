# PokéArcade

A classic-games website in Pokémon style. Pure HTML/CSS/JS, no build step —
open `index.html` directly or serve it from any static host.

**Play it live:** https://iihannibalii.github.io/pokemon-arcade/

## Structure

```
pokemon-arcade/
├── index.html            # Hub page: Pokédex-style game showcase
├── assets/
│   ├── css/
│   │   ├── theme.css     # Shared theme (arcade-shell): tokens, buttons, badges, Poké Ball
│   │   └── hub.css       # Hub-page-only styles
│   └── img/
│       ├── hub-bg.png    # Pixel-art meadow, generated locally (ComfyUI + SDXL)
│       └── tetris-bg.png # Pixel-art night meadow, generated locally
└── games/
    └── tetris/
        ├── index.html    # PokéTetris game page
        ├── tetris.css    # Game-page styles
        └── js/
            ├── engine.js # Pure game logic: SRS, 7-bag, gravity, lock delay, scoring
            ├── render.js # Canvas renderer (board, ghost, next, hold, type icons)
            ├── sound.js  # WebAudio synth: 8-bit SFX + original chiptune loop
            ├── mascot.js # Partner sprites: Pikachu → Raichu (Lv.5) → Alolan Raichu (Lv.10)
            └── main.js   # Input (DAS), game loop, HUD, FX, overlays
```

## Roadmap

1. ✅ Site skeleton + Pokémon-style hub
2. ✅ Tetris engine (canvas, SRS rotation, scoring, levels)
3. ✅ Pokémon-themed Tetris (type-based pieces, evolutions, WebAudio sound)
4. ✅ Polish: top-5 leaderboard, touch controls + swipe gestures, responsive layout,
   auto-pause on focus loss, board shake on a tetris, favicon
5. ✅ Background art generated with local AI (ComfyUI + SDXL, pixel-art style)
6. ⬜ PokéSnake
7. ✅ Published on GitHub Pages

## Principles

- Retro pixel style is the project's look (Press Start 2P, hard pixel borders,
  Game Boy-green playfield). A modern soft redesign was tried and rejected —
  do not restyle without asking.
- No ripped official assets or music. UI art is drawn in code (CSS/SVG/canvas);
  backgrounds and the partner sprites (Pikachu line fan-art) are generated locally
  with ComfyUI + SDXL. Note: the partner depicts official Pokémon characters —
  fine for personal use, reconsider before public hosting.
- Shared styles and utilities live in `assets/` (arcade-shell); each game is a
  standalone module under `games/<name>/`.
