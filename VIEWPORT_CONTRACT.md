# Mobile Viewport Contract

Line Tower Wars is a mobile-first Capacitor game with a fixed gameplay coordinate system and adaptive presentation around it.

## Gameplay Frame

- Canonical gameplay frame: `420 x 760`.
- Runtime constants: `LOGICAL_CANVAS_WIDTH = 420`, `LOGICAL_CANVAS_HEIGHT = 760`.
- Canvas backing dimensions stay `420 x 760`.
- Gameplay coordinates, tower anchors, lane starts/ends, ranges, projectile positions, and attacker positions are normalized against that fixed frame.
- Competitive visibility must be identical on every device. A taller, wider, or desktop viewport must not reveal extra playable battlefield.

## Scaling Rules

- The game frame scales uniformly from one shared layout calculation in `script.js`.
- CSS receives:
  - `--app-height`
  - `--game-frame-width`
  - `--game-frame-height`
  - `--game-frame-scale`
  - `--game-frame-aspect`
- `#arena-canvas` fills `.arena-wrap`, and `.arena-wrap` is always the same aspect ratio as `420 x 760`.
- Do not set independent canvas CSS width/height values, `zoom`, or viewport-height caps elsewhere.
- Use letterboxing, pillarboxing, or decorative page background outside the scaled frame.

## DOM Overlays

DOM elements that belong to the battlefield are anchored inside `.arena-wrap` and must derive their dimensions from `--game-frame-scale`.

This includes:
- tower slots
- tower art inside slots
- timer widget
- mana widget
- shop and match-end overlays

Global UI around the frame is still DOM, but its width derives from the shared frame:
- top bar
- HUD strip
- card docks
- status/action row

## Safe Areas And WebViews

- `index.html` uses `viewport-fit=cover`.
- CSS reads `env(safe-area-inset-top/right/bottom/left)`.
- `.app-shell.game-active` pads the game away from unsafe iOS/Android WebView edges.
- JS reads `visualViewport` when available, falling back to `innerWidth`/`innerHeight`.
- Real mobile Safari, Android Chrome, and Capacitor WebViews are the acceptance targets. Desktop responsive mode is a convenience only.

## Desktop Debug Preview

On pointer-fine desktop viewports at least `901px` wide, the game enters desktop debug preview:
- the `420 x 760` frame is centered in the browser
- scale is capped at `1`
- surrounding browser space is decorative fill, not playable space

## Artist Guidance

Artists should treat `420 x 760` as the gameplay-safe export, not as the whole possible art world.

- Deliver the current production battlefield as `420 x 760 PNG`.
- Keep critical readability inside that frame.
- Avoid critical details at extreme edges.
- Do not place gameplay-relevant detail behind tower anchors, timer, mana, or the midline.
- Provide layered or higher-resolution source with bleed when possible so engineering can later crop or fill decorative space without changing playable visibility.

## Device Test Checklist

Desktop convenience checks:
- open the local preview in a desktop browser
- confirm the centered debug frame does not stretch
- test narrow responsive widths around `320`, `360`, `390`, `414`, and `430` CSS pixels
- test desktop landscape and short-height windows

Capacitor Android:
- run `npx cap sync android`
- open Android Studio with `npx cap open android`
- install on a real Android phone
- verify Chrome and Android WebView behavior with gesture nav and three-button nav if available
- rotate the device and confirm playable visibility remains identical

Capacitor iOS:
- run `npx cap sync ios` on macOS
- open Xcode with `npx cap open ios`
- install on real iPhones, including one small-screen model and one notched/Dynamic Island model
- verify Safari and iOS WebView behavior
- confirm safe areas do not cover controls and the battlefield never stretches
