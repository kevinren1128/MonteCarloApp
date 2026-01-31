# Sidebar Snap-to-Width Design Document

> **Status**: Design Phase
> **Author**: Claude Code + Codex MCP
> **Date**: January 31, 2026

---

## Overview

Transform the current continuous-drag sidebar into a professional "snap-to-width" experience with three preset widths, smooth animations, and visual feedback during drag.

### Goals
- **Smooth drag** - User can freely drag the resize handle
- **Snappy release** - On mouseup, sidebar animates to nearest snap point
- **Visual feedback** - Clear indication of which snap point you're approaching
- **Professional feel** - Comparable to VS Code, Notion, or Linear sidebars
- **Accessibility** - Keyboard support, reduced motion respect

---

## Snap Points & Thresholds

### Three Sidebar Modes

| Mode | Width | Purpose | Content Shown |
|------|-------|---------|---------------|
| **Narrow** | 56px | Icons only | Tab icons, action icons, user avatar |
| **Medium** | 180px | Compact labels | Icons + short labels, hide shortcuts |
| **Wide** | 280px | Full content | Icons + labels + keyboard shortcuts |

### Snap Threshold Zones

```
←─────────────────────────────────────────────────────→
56px          118px         180px         230px         280px
 │             │             │             │             │
 │◄──Narrow───►│◄─────────Medium─────────►│◄────Wide───►│
 │   snap      │            snap          │    snap     │
 │   zone      │            zone          │    zone     │
```

**Threshold Logic:**
- `width ≤ 118px` → Snap to Narrow (56px)
- `118px < width ≤ 230px` → Snap to Medium (180px)
- `width > 230px` → Snap to Wide (280px)

### Why These Widths?

| Width | Rationale |
|-------|-----------|
| **56px** | Fits 40px icon + 8px padding each side. Standard collapsed width. |
| **180px** | Fits icon (18px) + gap (12px) + short label (~100px) + padding. Compact but readable. |
| **280px** | Fits full label + keyboard shortcuts. Comfortable for scanning. |

---

## Animation Specification

### Snap Animation (on release)

```css
transition: width 180ms cubic-bezier(0.2, 0.0, 0.0, 1);
```

**Why this curve?**
- `cubic-bezier(0.2, 0.0, 0.0, 1)` is a "fast out, slow in" ease
- Creates a snappy initial movement with soft landing
- 180ms is quick but perceivable - feels responsive without being jarring

**Alternative (spring animation):**
```javascript
// If using react-spring or framer-motion
config: {
  tension: 380,
  friction: 30,
  mass: 0.9
}
```

### During Drag
- **No transition** on width (immediate response to pointer)
- Transition on visual feedback elements only

### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  transition: width 0ms;
  /* or */ transition: width 80ms ease-out;
}
```

---

## Visual Feedback Design

### 1. Ghost Snap Indicator

During drag, show a subtle vertical line at the nearest snap point:

```
┌────────────────────────────────────────────────────┐
│ Sidebar content...  │░░░░░│                        │
│                     │░░░░░│                        │
│                     │░░░░░│  ← Ghost line at 180px │
│                     │░░░░░│                        │
│                     │░░░░░│                        │
└────────────────────────────────────────────────────┘
                      ↑
              Current drag position (~200px)
```

**Ghost Line Styles:**
- **Default**: `rgba(0, 212, 255, 0.15)` - subtle cyan
- **Approaching** (within 12px): `rgba(0, 212, 255, 0.4)` - brighter
- **Width**: 2px
- **Height**: 100%

### 2. Snap Point Label

When within 20px of a snap point, show a floating label:

```
┌─────────────────────────────────────────┐
│ Content...         │░║░│   ┌─────────┐  │
│                    │░║░│   │ Medium  │  │
│                    │░║░│   └─────────┘  │
│                    │░║░│                │
└─────────────────────────────────────────┘
```

**Label Styles:**
- Position: Above resize handle, offset by 8px
- Background: `rgba(0, 212, 255, 0.15)`
- Border: `1px solid rgba(0, 212, 255, 0.3)`
- Font: 10px, uppercase, letter-spacing 0.5px
- Fade in: `opacity 0.15s ease`

### 3. Resize Handle Enhancement

**Default state:**
- 6px wide transparent hit area
- On hover: `rgba(0, 212, 255, 0.15)` background

**During drag:**
- `rgba(0, 212, 255, 0.3)` background
- Slight glow: `box-shadow: 0 0 8px rgba(0, 212, 255, 0.3)`

**Approaching snap point:**
- Pulse glow animation
- Handle color intensifies

### 4. Snap Zone Progress (Optional)

Show which zone you're in during drag:

```
┌─────────────────┐
│ ●──○──○        │  ← Narrow selected
│ ○──●──○        │  ← Medium selected
│ ○──○──●        │  ← Wide selected
└─────────────────┘
```

Position: Top-right of sidebar, fades in during drag.

---

## State Management

### Sidebar State Shape

```javascript
const [sidebarState, setSidebarState] = useState({
  mode: 'wide',           // 'narrow' | 'medium' | 'wide'
  targetWidth: 280,       // Snap target
  currentWidth: 280,      // Current render width
  isDragging: false,      // Is user dragging?
  nearestSnap: 'wide',    // For visual feedback during drag
});
```

### State Transitions

```
         DRAG_START
              │
              ▼
┌─────────────────────────┐
│   isDragging: true       │
│   currentWidth = pointer │
│   nearestSnap = computed │
└────────────┬────────────┘
             │
         DRAG_MOVE (continuous)
             │
             ▼
┌─────────────────────────┐
│   currentWidth = pointer │
│   nearestSnap = computed │
└────────────┬────────────┘
             │
         DRAG_END
             │
             ▼
┌─────────────────────────┐
│   isDragging: false      │
│   mode = nearestSnap     │
│   targetWidth = SNAPS[m] │
│   currentWidth → animate │
└─────────────────────────┘
```

### Snap Calculation

```javascript
const SNAP_WIDTHS = {
  narrow: 56,
  medium: 180,
  wide: 280,
};

const SNAP_THRESHOLDS = [118, 230]; // Midpoints

function calculateNearestSnap(width) {
  if (width <= SNAP_THRESHOLDS[0]) return 'narrow';
  if (width <= SNAP_THRESHOLDS[1]) return 'medium';
  return 'wide';
}
```

---

## Implementation Plan

### Phase 1: Core Snap Logic (30 min)
1. Define snap constants (widths, thresholds)
2. Add `mode` state ('narrow' | 'medium' | 'wide')
3. Update mouseup handler to snap to nearest width
4. Add CSS transition for snap animation

### Phase 2: Visual Feedback (45 min)
1. Add ghost snap indicator line
2. Add floating snap label (Narrow/Medium/Wide)
3. Enhance resize handle with glow effects
4. Add zone indicator dots (optional)

### Phase 3: Polish & Edge Cases (30 min)
1. Handle rapid drag/release
2. Keyboard accessibility (arrow keys to change mode)
3. Reduced motion support
4. Persist mode to localStorage (not just width)
5. Touch/mobile support

### Phase 4: Testing (30 min)
1. Playwright tests for snap behavior
2. Test all snap transitions
3. Test visual feedback timing
4. Test accessibility

---

## Keyboard Accessibility

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + B` | Toggle between current and narrow |
| `Cmd/Ctrl + Shift + B` | Cycle: Narrow → Medium → Wide → Narrow |
| `Arrow Left` (when handle focused) | Snap to next narrower mode |
| `Arrow Right` (when handle focused) | Snap to next wider mode |

### ARIA Attributes

```jsx
<div
  role="separator"
  aria-orientation="vertical"
  aria-valuenow={currentWidth}
  aria-valuemin={56}
  aria-valuemax={280}
  aria-label={`Sidebar width: ${mode}. Use arrow keys to resize.`}
  tabIndex={0}
  onKeyDown={handleKeyboardResize}
/>
```

---

## Metrics & Success Criteria

### UX Quality Metrics
- [ ] Snap animation completes in <200ms
- [ ] Visual feedback appears within 1 frame of crossing threshold
- [ ] No layout shift during drag
- [ ] No jank during snap animation (60fps)

### Functional Criteria
- [ ] All three snap points work correctly
- [ ] Mode persists across page reload
- [ ] Works with keyboard only
- [ ] Respects prefers-reduced-motion
- [ ] Touch drag works on mobile

---

## Open Questions

1. **Bias direction**: Should thresholds bias toward wider or narrower? (Finance apps typically prefer wider for data density)

2. **Snap sound**: Should there be an optional subtle audio click on snap? (Probably not, but worth asking)

3. **Medium mode content**: In medium mode (180px), should we:
   - Show shortened labels (e.g., "Pos" instead of "Positions")
   - Show full labels but hide keyboard shortcuts
   - Same as wide but tighter spacing?

---

## References

- VS Code sidebar: snap to open/closed with smooth transition
- Notion sidebar: hover to peek, snap on drag release
- Linear sidebar: smooth resize with snap points
- Figma sidebar: continuous resize (no snap, but very smooth)
