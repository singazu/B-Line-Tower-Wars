# Jon Carling Asset Review Log

This file tracks incoming art from Jon Carling, suitability for current gameplay use, and the upgrade path to launch-quality assets.

## Scope

- Project: B Line Tower Wars
- Reviewer: Codex
- Source batch: Tower first drafts shared in chat on 2026-05-03
- Intent: Use now unless truly unsuitable, while defining stricter polish targets for final release

## Decision Key

- `Use now`: Good enough for integration in current milestone.
- `Use with guardrails`: Integrate, but keep listed fixes queued before launch.
- `Hold`: Not suitable even for current milestone.

## Batch 1: Towers (Jon Carling)

### Receipt Confirmation

Received:

- `C:/Users/bmaga/Downloads/green_tower_jc.png`
- `C:/Users/bmaga/Downloads/purple_tower_jc.png`
- `C:/Users/bmaga/Downloads/yellow_tower_jc.png`
- `C:/Users/bmaga/Downloads/blue_tower_jc.png`
- `C:/Users/bmaga/Downloads/red_tower_jc.png`

### Technical Readiness Snapshot

All files are PNG with non-empty alpha and readable silhouettes.

Measured canvas/bounds:

| File | Canvas | Occupied Bounds (w x h) | Left/Right Pad | Top/Bottom Pad | X Center Offset |
|---|---|---:|---:|---:|---:|
| green_tower_jc.png | 384x384 | 278x323 | 55 / 51 | 34 / 27 | +2.0 px |
| purple_tower_jc.png | 384x384 | 236x335 | 76 / 72 | 36 / 13 | +2.0 px |
| yellow_tower_jc.png | 336x384 | 264x332 | 37 / 35 | 30 / 22 | +1.0 px |
| blue_tower_jc.png | 384x384 | 239x328 | 76 / 69 | 30 / 26 | +3.5 px |
| red_tower_jc.png | 384x384 | 291x332 | 53 / 40 | 35 / 17 | +6.5 px |

Notes:

- Four assets are `384x384`; yellow is `336x384` and should be normalized.
- Horizontal centering drift is small to moderate; red is visibly right-biased.
- Bottom padding varies (13-27 px), so base alignment will jump if dropped in as-is.

### Suitability Verdict (Current Milestone)

- `green_tower_jc.png`: `Use with guardrails`
- `purple_tower_jc.png`: `Use with guardrails`
- `yellow_tower_jc.png`: `Use with guardrails`
- `blue_tower_jc.png`: `Use with guardrails`
- `red_tower_jc.png`: `Use with guardrails`

None are true `Hold` candidates for first-draft gameplay.

## Guardrails for Immediate Integration

1. Standardize export size to `384x384` for all tower portraits/sprites.
2. Align each tower base to a shared baseline (same bottom padding target).
3. Recenter to shared X pivot (center offset within +/-2 px).
4. Preserve transparent background alpha; no opaque black matte.
5. Keep silhouette area within a similar occupancy band to avoid one tower reading much larger/smaller in slots.

## Launch-Ready Art Spec (Towers)

Use this as the target for polished replacements:

1. Canvas and framing
- `384x384` PNG, transparent background.
- Subject centered with X pivot offset <= 2 px.
- Shared baseline: bottom padding fixed (recommend 20 px +/-2 px).

2. Visual consistency
- Line weight family consistent across all tower classes.
- Comparable visual mass (avoid extreme width or height outliers unless gameplay-role intentional).
- Highlight/shadow style consistent (same count/intensity range of specular accents).

3. Readability at mobile scale
- Primary form and role-defining silhouette readable at ~64-96 px display size.
- Internal details should survive downscale; avoid micro-shapes thinner than final stroke width.

4. Export quality
- Clean edge alpha with no dark fringe/halo.
- No accidental clipping at image bounds.
- Uniform naming convention: `<color>_tower_jc.png` (current naming is good).

## Next Assets Queue

Planned to append in this same file as they arrive:

- Battlefield background
- Tower/creep housing squares
- New mana symbol
- Any additional tower/creep/UI revisions

## Batch 2: Battlefield + Selection UI + Labels + Mana Shield

### Receipt Confirmation

Received:

- `C:/Users/bmaga/Downloads/battlefield_background.png`
- `C:/Users/bmaga/Downloads/tower_and_creep_selection_frame.png`
- `C:/Users/bmaga/Downloads/towerstext.png`
- `C:/Users/bmaga/Downloads/attackerstext.png`
- `C:/Users/bmaga/Downloads/mana_shield_jc.png`

### Technical Readiness Snapshot

| File | Canvas | Opaque Fill | Occupied Bounds | Notes |
|---|---|---:|---|---|
| battlefield_background.png | 420x760 | 100% | full canvas | Exact match to current arena canvas size (`420x760`) |
| tower_and_creep_selection_frame.png | 432x384 | 72.94% | 366x337 | Rounded rectangle, centered with transparent margins |
| towerstext.png | 528x144 | 21.53% | 463x109 | Black text on transparent BG, very wide format |
| attackerstext.png | 624x144 | 20.66% | 558x102 | Black text on transparent BG, very wide format |
| mana_shield_jc.png | 256x295 | 29.99% | 214x223 | Non-square canvas and right-biased placement (L37/R5) |

Current UI constraints relevant to these assets:

- Arena canvas is fixed at `420x760` in HTML and CSS.
- Mana icon container is square (`3.5rem x 3.5rem`) with full-fill image.
- Tower/attacker cards are small mobile-first cells; headings sit in compact dock headers.

### Suitability Verdict (Current Milestone)

- `battlefield_background.png`: `Use now`
- `tower_and_creep_selection_frame.png`: `Use with guardrails`
- `towerstext.png`: `Use with guardrails` (temporary only)
- `attackerstext.png`: `Use with guardrails` (temporary only)
- `mana_shield_jc.png`: `Use with guardrails`

No item is a strict `Hold`, but three are not launch-ready as-is.

## Asset-Specific Guidance

### battlefield_background.png

Why it fits now:

- Perfect dimensional fit for `canvas` (`420x760`), so no stretching required.
- Neutral texture should support unit readability.

Launch polish targets:

1. Prepare 2-3 subtle tonal variants for A/B readability tests with tower/creep sprites.
2. Keep contrast low-frequency so projectile/effect VFX remain legible.
3. If exporting larger master art, still provide a production-cut `420x760` version to avoid runtime resampling blur.

### tower_and_creep_selection_frame.png

Why it can work now:

- Usable as a frame layer for selection slots.

Risks:

- Current light gray fill can flatten contrast against white card backgrounds.
- Corners/radius may not visually match existing card radius family.

Launch polish targets:

1. Provide transparent interior + designed border/shadow version so card content reads clearly.
2. Export in a size that maps cleanly to one card cell (or as a 9-slice-friendly frame).
3. Deliver both standard and high-density versions if Android scaling artifacts appear.

### towerstext.png / attackerstext.png

Why they work temporarily:

- Functionally valid replacements for live text in dock headers.

Risks:

- Wide raster text does not adapt well to responsive wrapping.
- Black lettering may lose contrast on dark UI contexts unless backed by a plate/stroke.
- Raster text can blur at small sizes across devices.

Launch polish targets:

1. Keep these as temporary art labels only; return to live text for final UI accessibility/localization.
2. If retaining art labels, supply at least two responsive widths and include a light outline/glow for dark backgrounds.
3. Normalize baseline/cap-height relationship between the two so header rhythm matches.

### mana_shield_jc.png

Why it can work now:

- Strong silhouette and theme fit for a mana emblem.

Risks:

- Canvas is non-square (`256x295`) while UI slot is square.
- Subject is horizontally off-center, so it may appear shifted in the HUD bubble.

Launch polish targets:

1. Re-export as square canvas (recommend `256x256` or `384x384`) with centered shield.
2. Align optical center and leave balanced padding for numeric overlay legibility.
3. Verify contrast under the mana number text; reserve a cleaner center area if needed.

## Batch 3: Creep 4-Frame Sheets (Imp/Wisp/Brute Replacements)

### Receipt Confirmation

Received:

- `C:/Users/bmaga/Downloads/spideranim.png` (imp replacement)
- `C:/Users/bmaga/Downloads/tankanim.png`
- `C:/Users/bmaga/Downloads/runneranim.png`
- `C:/Users/bmaga/Downloads/jellyfishanim.png` (wisp replacement)
- `C:/Users/bmaga/Downloads/eyeanim.png` (brute replacement)

### Runtime Compatibility Check

Current game pipeline in `script.js` expects creep sprite strips with:

- transparent PNG background
- fixed `frameWidth: 64`, `frameHeight: 64`
- horizontal strip animation sampling
- currently configured `frames: 3` per creep

New sheets are all divisible into 4 equal frames, but they are not in 64x64 format and use bright green matte background (no transparency alpha).

### Technical Readiness Snapshot

| File | Canvas | Frame Width (4-way split) | Background | Notes |
|---|---|---:|---|---|
| spideranim.png | 1088x206 | 272 | Solid chroma green | Good motion; needs matte removal + resize/export |
| tankanim.png | 1080x302 | 270 | Solid chroma green | Usable, but rigid silhouette motion |
| runneranim.png | 1104x286 | 276 | Solid chroma green | Strongest readable run motion |
| jellyfishanim.png | 968x260 | 242 | Solid chroma green | Good bob/tentacle variation |
| eyeanim.png | 1080x272 | 270 | Solid chroma green | Motion is subtle; likely weak at gameplay scale |

### Suitability Verdict (Current Milestone)

- `spideranim.png`: `Use with guardrails`
- `tankanim.png`: `Use with guardrails`
- `runneranim.png`: `Use with guardrails`
- `jellyfishanim.png`: `Use with guardrails`
- `eyeanim.png`: `Use with guardrails` (borderline; animation subtle)

Important: these are not drop-in compatible yet because the green matte will render in-game without preprocessing.

## Integration Mapping

Planned semantic replacement mapping:

1. `imp` -> spider
2. `wisp` -> jellyfish
3. `brute` -> eye
4. `runner` remains runner
5. `tank` remains tank

## Guardrails for Immediate Integration

1. Remove green matte and export transparent background sheets.
2. Normalize to frame size compatible with runtime (`64x64` per frame recommended for zero-code art swap).
3. Export as horizontal strips with 4 frames and update `frames` config from `3` to `4` for affected units.
4. Keep per-frame baseline and center pivot stable to prevent jitter during animation.
5. Verify silhouette readability at render size (~20 px in combat), especially for eye and jellyfish tentacles.

## Launch-Ready Animation Spec (Creeps)

1. File format and dimensions
- Transparent PNG strips.
- Consistent frame size across all creeps (prefer `64x64` or another single standardized size).
- 4-frame loops with clean looping pose from frame 4 back to frame 1.

2. Motion readability
- Distinct silhouette change each frame, readable at tiny scale.
- Avoid micro-motion only in internal details; prioritize limb/body displacement.
- Maintain stable foot/base contact region for grounded units.

3. Art consistency
- Unified line-weight and shading style across all creep classes.
- Comparable visual mass between classes after downscale.
- No clipped limbs or cropped extremities at frame edges.

4. Export hygiene
- No chroma matte spill/halo on outlines.
- Tight but safe padding inside each frame.
- Naming convention suggestion for production: `<unit>-sprite-sheet-jc.png`.

## Batch 4: Static Attacker Icons (Selection Zone)

### Receipt Confirmation

Received:

- `C:/Users/bmaga/Downloads/eye.png`
- `C:/Users/bmaga/Downloads/jellyfish.png`
- `C:/Users/bmaga/Downloads/spider.png`
- `C:/Users/bmaga/Downloads/runner.png`
- `C:/Users/bmaga/Downloads/tank.png`

### Transparency Verification

Confirmed from file data: all five PNGs include real transparency (alpha=0 background plus antialiased edge alpha). They are suitable for transparent compositing in selection cards.

### Technical Readiness Snapshot

| File | Canvas | Fill % | Bounds (w x h) | Center Offset X | Notable Fit Risk |
|---|---|---:|---:|---:|---|
| eye.png | 336x336 | 37.20% | 208x276 | -1.0 px | Good overall; little extra headroom needed if resized aggressively |
| jellyfish.png | 336x336 | 30.88% | 219x293 | -9.5 px | Significant left bias; will read off-center in card |
| spider.png | 336x336 | 29.53% | 306x208 | 0.0 px | Very wide silhouette vs other attackers |
| runner.png | 336x336 | 32.23% | 217x294 | -1.5 px | Bottom padding only 3 px, may sit visually low |
| tank.png | 336x336 | 47.88% | 240x294 | 0.0 px | Heaviest fill; likely to read larger than others |

### Suitability Verdict (Current Milestone)

- `eye.png`: `Use now`
- `jellyfish.png`: `Use with guardrails`
- `spider.png`: `Use with guardrails`
- `runner.png`: `Use with guardrails`
- `tank.png`: `Use with guardrails`

None are `Hold`. All can be used immediately as first-draft selection art.

## Guardrails for Immediate Integration (Selection Zone)

1. Keep all icons on transparent background (already satisfied).
2. Normalize optical centering before final export; jellyfish needs correction first.
3. Normalize perceived size across the five icons so tank/spider do not dominate card read.
4. Keep baseline comfort padding (recommend >= 12 px) so icons do not feel clipped at the card bottom.

## Launch-Ready Static Icon Spec (Attackers)

1. Canvas and alignment
- Keep uniform square canvas (`336x336` is fine for source masters).
- Center offset target within +/-2 px.
- Use consistent bottom/headroom padding band across all attackers.

2. Readability in card scale
- Validate at the live attacker-card render size (small mobile cells).
- Ensure silhouette remains immediately identifiable without relying on internal detail.

3. Cross-set consistency
- Align line weight and outline darkness with tower set.
- Match highlight/shadow intensity family so towers and attackers feel from the same set.
