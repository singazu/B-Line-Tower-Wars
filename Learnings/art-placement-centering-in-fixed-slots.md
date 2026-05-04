# Art Placement: Centering Oversized Towers In Fixed Slots

## Context

When tower art was increased to `96x96` while battlefield slot boxes stayed small (`3.7rem x 3.55rem`), towers appeared visually offset (down/right) and slot sizing looked inconsistent.

## Root Cause

Relative/grid alignment and margin hacks were not stable with:

- transparent padding inside sprite PNGs
- overflow rendering outside slot bounds
- level-up scaling (`+20%`) applied on the same element

These interactions made anchors drift and feel inconsistent across towers.

## Working Pattern

Keep slot boxes fixed-size and place tower sprites with absolute center anchoring.

### CSS pattern

```css
.tower-slot {
  width: 3.7rem;
  height: 3.55rem;
  overflow: visible;
}

.slot-tower {
  position: relative;
  width: 100%;
  height: 100%;
}

.tower-icon-slot {
  --tower-scale: 1;
  width: 96px;
  height: 96px;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) scale(var(--tower-scale));
  transform-origin: center center;
}

.tower-icon-slot.level-2 {
  --tower-scale: 1.2;
}
```

## Why This Held Up

1. Slot dimensions remained stable for gameplay readability.
2. Oversized art could spill outside slots without resizing containers.
3. Level-up scale remained centered because scale is applied from center with the same anchor transform.
4. This approach avoided per-sprite offset hacks.

## Reuse Guidance

When swapping in new art sets:

1. Lock slot/container dimensions first.
2. Use absolute `50%/50%` centering for oversized unit art.
3. Put overflow on the slot container, not on the image.
4. Apply upgrade scaling through a CSS variable so base and upgraded units share one centering rule.
