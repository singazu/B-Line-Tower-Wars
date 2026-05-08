# Art Pack Notes

## Current Test Pack

`script.js` currently sets `ACTIVE_ART_PACK = "unfuneralOD"` to test UnfuneralOD's assets.

UnfuneralOD files copied into runtime paths:

- Battlefield: `assets/unfuneralod/arena/arena2.png` (`420x760`)
- Towers: `assets/unfuneralod/towers/{violet,yellow,red,green,blue}.png` (`64x64`)
- Creeps: `assets/unfuneralod/creeps/imp.png`, `assets/unfuneralod/creeps/runner.png` (`256x64`, four `64x64` frames)

The same files are mirrored under `www/assets/unfuneralod/...` for the packaged app folder.

## Jon Carling Baseline

To revert to Jon Carling's art, set `ACTIVE_ART_PACK = "jonCarling"` in `script.js` and `www/script.js`.

Jon Carling runtime paths and canvas assumptions:

- Battlefield: `assets/arena/battlefield_background.png` (`420x760`), drawn directly to fill the canvas with `ctx.drawImage(..., 0, 0, canvas.width, canvas.height)`.
- Towers: `assets/towers/{violet,yellow,red,green,blue}.png` (`384x384`), rendered as DOM images in tower cards at `76x76` and tower slots at `96x96`; level 2 applies a CSS scale of `1.2`.
- Imp: `assets/creeps/imp-sprite-sheet.png` (`1088x206`), four frames of `272x206`, rendered in battle as a `42x42` canvas draw.
- Runner: `assets/creeps/runner-sprite-sheet.png` (`1104x286`), four frames of `276x286`, rendered in battle as a `42x42` canvas draw.
- Other creeps remain Jon's sprite sheets in both art packs for now: brute `270x272`, wisp `242x260`, tank `270x302`, all four frames at `6fps`.
- Creep shop icons use separate Jon icon files: `spider-icon.png`, `runner-icon.png`, `eye-icon.png`, `jellyfish-icon.png`, `tank-icon.png`, each displayed at `66x66`.

Gameplay slot geometry stayed unchanged for the UnfuneralOD test because `arena2.png` matches the existing `420x760` canvas and its tower boxes align with the normalized tower positions in `script.js`.

## Upcoming Tower Level Art

Artist instructions now request separate level 1 and level 2 tower files:

- `{tower}-l1.png`
- `{tower}-l2.png`

The level 2 file should use the same canvas size as level 1, but the visible tower should include clear upgrade appointments instead of relying on runtime scaling. Once these files start arriving, replace the current level 2 CSS scale-up behavior with art-pack-specific level asset selection.

For illustrated packs, expect normalized tower exports around `384x384`. For pixel-art packs, `64x64` is preferred and `48x48` is acceptable when used consistently across the pack; pixel art should be rendered with nearest-neighbor/pixelated scaling.

## Upcoming Creep Direction Art

Artist instructions now treat creep names as stable gameplay role ids and player-facing labels rather than literal creature requirements. Artists can choose the visual design for each role, such as drawing the `imp` role as a spider, but the game should still call that role `imp`.

Runtime should support either:

- one movement sheet per role, when the design still reads correctly after vertical flip
- separate `{role}-move-up.png` and `{role}-move-down.png` sheets when the design has clear directionality

When directional sheets are present, player-sent attackers should use the up sheet and opponent-sent attackers should use the down sheet. Both sheets for a role must share frame count, frame size, pivot, baseline, and perceived scale.
