# Battle Screen Template Directions

Use this file with:

- `.chrome-art-check/battle-screen-630x1140-bleed-template-v11.png`

## What to draw

- Draw on the full `630 x 1140` artboard.
- The centered `420 x 760` safe screen must contain everything gameplay-critical.
- The area outside the safe screen is decorative bleed. It may be visible on some devices and cropped on others.
- Do not put gameplay-critical objects, readable text, lane markers, or important silhouettes in the bleed.

## Fixed screen areas

- Safe screen: `420 x 760`
- Safe screen position inside source: `x=105 y=190`
- Bleed: `105 px` left/right, `190 px` top/bottom
- Locked playable battlefield: `352 x 530`, at `x=34 y=48` inside the safe screen
- Tower dock: `388 x 72`, with five `70 x 64` card boxes
- Attacker dock: `388 x 72`, with five `70 x 64` card boxes

## UI frame proposals

- Round/timer frame: `62 x 206`
- Round number box: `50 x 34`
- Timer bar: `16 x 108`
- Timer text box: `52 x 30`
- Score/mana frame: `66 x 184`
- Opponent score box: `56 x 36`
- Mana box: `54 x 54`
- Player score box: `56 x 36`

## Scaling

- These numbers are design coordinates, not required source resolution.
- You may draw at `0.5x`, `1x`, `2x`, or `4x`.
- If you scale, scale every coordinate and frame size uniformly.
- Example: at `2x`, the source artboard is `1260 x 2280` and the safe screen is `840 x 1520`.

## Keep clear

- Keep tower anchor points visible and readable.
- Keep the center battlefield readable for units/projectiles.
- Keep UI frames readable for 2-3 digit values.
- Do not bake tutorial text, menu buttons, records buttons, or pause controls into the battle art.
