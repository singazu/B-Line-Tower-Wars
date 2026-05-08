# Line Tower Wars - Artist Instructions

This package defines what to deliver so art packs can be prepared for the current build and the next cosmetic-art pipeline.

## 1) Core terminology

- Gameplay Screen: the full in-match UI (top bar, HUD, battlefield, docks, status row).
- Battlefield Canvas: the central battle area only.

For this art pass, you are producing assets for the Battlefield Canvas plus unit/tower icons.

## 2) Battlefield skin deliverable

- Primary file: `lane-bg.png`
- Export size: `420 x 760` pixels
- Format: PNG-24, sRGB

Use this visual placement guide while painting:
- `assets/arena/artist-guide-overlay.svg`

Guidance:
- Design to the full 420x760 area.
- Avoid placing critical details under:
  - left-middle timer zone
  - right-middle mana zone
  - tower slot anchors near top and bottom
- Midline should remain readable for gameplay contrast.
- The outer three-slot rows are inset from the top/bottom edges to leave room for shallow 2.5D depth, trim, framing, or environmental detail. Keep that depth decorative; do not put gameplay-critical information behind tower silhouettes.

## 3) Tower art deliverables

Each tower needs level 1 and level 2 art. Level 2 art must use the same canvas size as level 1, but the visible tower should read as upgraded: larger visual presence, stronger silhouette, added structure, glow, ornament, weapon detail, animation-ready accents, or other clear appointments. Do not just upscale the level 1 tower.

Files:
- `violet-l1.png`
- `violet-l2.png`
- `yellow-l1.png`
- `yellow-l2.png`
- `red-l1.png`
- `red-l2.png`
- `green-l1.png`
- `green-l2.png`
- `blue-l1.png`
- `blue-l2.png`

Format:
- PNG-24 with alpha, sRGB
- Transparent background
- Same canvas size for every tower in the pack
- Same canvas size for level 1 and level 2 versions of a tower

Illustrated/high-resolution packs:
- Recommended export size: `384 x 384`
- `512 x 512` source files are welcome, but production exports should be normalized consistently.
- Keep the tower centered with a shared base/bottom alignment.
- Must read clearly when displayed around `76 x 76`, `96 x 96`, and `115 x 115`.

Pixel-art packs:
- Recommended export size: `64 x 64`
- `48 x 48` is acceptable if every tower in the pack uses that same grid.
- Use crisp pixels; avoid antialiasing unless it is a deliberate part of the style.
- Engineering will upscale with nearest-neighbor/pixelated rendering.
- Keep level 2 on the same canvas size; make the visible sprite feel upgraded inside that canvas.

Notes:
- Keep silhouettes centered.
- Leave transparent padding around edges so level 2 additions do not clip.
- Keep the base/pivot consistent between level 1 and level 2 so upgrading does not make the tower jump.
- Level 2 should be identifiable at gameplay size without relying on tiny details.
- Current runtime may temporarily scale level 1 art by 20% for upgraded towers. Once level 2 files are delivered, engineering should render the delivered level 2 asset instead of applying that scale-up.

## 4) Attacker art deliverables

The gameplay has five attacker roles. These names stay fixed in the game UI, balance sheets, code, and documentation even when an artist's visual design does not literally match the name. For example, the `imp` role may be drawn as a spider, but players and engineering will still refer to that unit as `imp`.

Role ids:
- `imp`
- `runner`
- `brute`
- `wisp`
- `tank`

For each role, provide:
- short description of the design/readability intent
- static shop icon, unless the first animation frame is explicitly approved as the icon
- movement sprite sheet

Per-file layout:
- Horizontal frame strip
- Preferred loop: 4 frames
- Consistent frame size within each sheet
- Transparent background

Format:
- PNG-24 with alpha, sRGB

Direction requirements:
- Player-sent attackers move upward, from the bottom half toward the opponent.
- Opponent-sent attackers move downward, from the top half toward the player.
- If the design is symmetrical or still looks correct when vertically flipped, one movement sheet is acceptable:
  - `{role}-move.png`
- If the design has a clear face, body direction, lighting, readable front/back, textural asymmetry, carried object, or any detail that looks wrong when flipped, provide two movement sheets:
  - `{role}-move-up.png`
  - `{role}-move-down.png`
- The up and down sheets must use the same canvas size, frame count, baseline, center pivot, and perceived scale.
- Do not rely on engineering to rotate or flip a directional creature if doing so would make the art read incorrectly.

Examples:
- If `imp` is designed as a top-down spider with radial legs, one sheet may be enough.
- If `runner` has a visible face, weapon, hair, backpack, or forward-leaning body, provide both up and down sheets.
- If a floating unit has lighting or tentacles that imply direction, provide both directions unless the flipped version still looks intentional.

## 5) Naming and handoff rules

- Use exact filenames listed above.
- No spaces in filenames.
- No extra suffixes like `_final`, `_v2`, `_new`.
- Deliver source files separately if needed, but exports must match these names and sizes.

## 6) Technical constraints for deployment readiness

- Keep all gameplay assets in PNG with alpha.
- Keep all color in sRGB.
- Avoid tiny text baked into art.
- Avoid edge glow that relies on dark-only backgrounds.
- Ensure strong contrast against both lighter and darker lane zones.

## 7) Drop-in folders

Place final exports here:

- Battlefield skin:
  - `assets/arena/lane-bg.png`
- Towers:
  - `assets/towers/*.png`
- Attackers:
  - `assets/creeps/*-sprite-sheet.png`

If you need reference screenshots from live gameplay placements, request a capture pass from engineering.
