# Input Hover Behavior - Visual Reference Guide

## 🎨 Hover States Visual Reference

### Standard Text Input

```
┌─────────────────────────────────────┐
│ Normal State                        │
│ Border: #e9ecef (light gray)       │
│ Background: white                   │
└─────────────────────────────────────┘
                ↓ hover
┌─────────────────────────────────────┐
│ Hover State                         │
│ Border: #adb5bd (medium gray) ✨    │
│ Background: #f8f9fa (light gray) ✨ │
└─────────────────────────────────────┘
                ↓ click/focus
┌─────────────────────────────────────┐
│ Focus State                         │
│ Border: #667eea (blue)              │
│ Box-shadow: rgba(102,126,234,0.25)  │
│ Background: white                   │
└─────────────────────────────────────┘
```

### Password Input with Toggle

```
┌────────────────────────────────────┬──┐
│ Normal State                       │👁│
│ Border: #e9ecef                   │  │
└────────────────────────────────────┴──┘
                ↓ hover
┌────────────────────────────────────┬──┐
│ Hover State ✨                     │👁│
│ Border: #adb5bd                   │  │
│ Background: #f8f9fa               │  │
└────────────────────────────────────┴──┘
```

### Validation States

#### Valid Input
```
┌─────────────────────────────────────┐
│ Valid - Normal                      │
│ Border: #198754 (green)             │
│ ✓ Validation passed                │
└─────────────────────────────────────┘
                ↓ hover
┌─────────────────────────────────────┐
│ Valid - Hover ✨                    │
│ Border: #198754 (green)             │
│ Background: rgba(25,135,84,0.05)    │
│ ✓ Validation passed                │
└─────────────────────────────────────┘
```

#### Invalid Input
```
┌─────────────────────────────────────┐
│ Invalid - Normal                    │
│ Border: #dc3545 (red)               │
│ ⚠ Validation error                 │
└─────────────────────────────────────┘
                ↓ hover
┌─────────────────────────────────────┐
│ Invalid - Hover ✨                  │
│ Border: #dc3545 (red)               │
│ Background: rgba(220,53,69,0.05)    │
│ ⚠ Validation error                 │
└─────────────────────────────────────┘
```

### Disabled Input
```
┌─────────────────────────────────────┐
│ Disabled - No Hover Effect          │
│ Border: #dee2e6                     │
│ Background: #f8f9fa                 │
│ Opacity: 0.6                        │
│ Cursor: not-allowed 🚫             │
└─────────────────────────────────────┘
```

### Select Dropdown
```
┌────────────────────────────────┬───┐
│ Normal State                   │ ▼ │
└────────────────────────────────┴───┘
                ↓ hover
┌────────────────────────────────┬───┐
│ Hover State ✨                 │ ▼ │
│ Border: #adb5bd                    │
│ Background: #f8f9fa                │
│ Cursor: pointer 👆                │
└────────────────────────────────┴───┘
```

### Checkbox/Radio
```
Normal: □  Radio: ○
  ↓ hover (Scale 1.05)
Hover:  □̲  Radio: ○̲  ✨
  ↓ checked
Checked: ☑  Radio: ⦿
```

### File Input
```
┌─────────────────────────────────────┐
│ [Choose File] No file chosen        │
└─────────────────────────────────────┘
                ↓ hover
┌─────────────────────────────────────┐
│ [Choose File] No file chosen ✨     │
│ Border: #adb5bd                     │
│ Background: #f8f9fa                 │
│ Cursor: pointer 👆                 │
└─────────────────────────────────────┘
```

### Range Slider
```
Normal:   ├────●────────────────┤
            ↓ hover thumb
Hover:    ├────●̲────────────────┤  ✨
          (thumb scales 1.1)
```

### Textarea
```
┌─────────────────────────────────────┐
│ Normal State                        │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
                ↓ hover
┌─────────────────────────────────────┐
│ Hover State ✨                      │
│ Border: #adb5bd                     │
│ Background: #f8f9fa                 │
│                                     │
└─────────────────────────────────────┘
```

## 🎨 Color Palette

### Hover Colors
```css
Border (Hover):     #adb5bd  ██ (Gray 500)
Background (Hover): #f8f9fa  ▓▓ (Gray 50)
```

### Focus Colors (Per Theme)
```css
/* General/Student Theme */
Focus Border: #667eea  ██ (Purple-Blue)
Focus Shadow: rgba(102, 126, 234, 0.25)

/* Instructor Theme */
Focus Border: #3498db  ██ (Blue)
Focus Shadow: rgba(52, 152, 219, 0.25)
```

### Validation Colors
```css
Valid Border:   #198754  ██ (Green)
Valid Hover BG: rgba(25, 135, 84, 0.05)

Invalid Border: #dc3545  ██ (Red)
Invalid Hover BG: rgba(220, 53, 69, 0.05)
```

### Disabled State
```css
Border:     #dee2e6  ▓▓ (Gray 300)
Background: #f8f9fa  ▓▓ (Gray 50)
Opacity:    0.6
```

## 🎬 Animation Timing

### Transitions
```
Property: all
Duration: 0.2s (200ms)
Easing:   ease-in-out
```

### Scale Animations (Checkbox/Radio)
```
Transform: scale(1.05)
Duration:  0.2s
Trigger:   hover
```

## 📱 Responsive Behavior

### Desktop (Mouse)
- ✅ Hover triggers on mouseover
- ✅ Smooth transitions
- ✅ Visual feedback immediate

### Mobile/Touch (No Mouse)
- ✅ Hover triggers on tap/active state
- ✅ Same visual feedback
- ✅ Optimized for touch

### Tablet (Hybrid)
- ✅ Supports both mouse and touch
- ✅ Context-aware behavior
- ✅ Smooth experience

## 🔄 State Priority Order

```
1. :disabled      (Highest - No interaction)
2. :focus         (Active editing state)
3. :hover         (Mouse over)
4. :valid/:invalid (Validation feedback)
5. normal         (Default state)
```

## 📊 Z-Index Stacking

```
┌─────────────────┐  z-index: 2
│ Focused Input   │  (Top layer)
└─────────────────┘
┌─────────────────┐  z-index: 1
│ Hovered Input   │  (Middle layer)
└─────────────────┘
┌─────────────────┐  z-index: 0
│ Normal Input    │  (Base layer)
└─────────────────┘
```

## 🎯 Cursor Types

| Element Type | Normal | Hover | Disabled |
|-------------|--------|-------|----------|
| Text Input  | text   | text  | not-allowed |
| Checkbox    | pointer| pointer| not-allowed |
| Radio       | pointer| pointer| not-allowed |
| Select      | pointer| pointer| not-allowed |
| File Input  | pointer| pointer| not-allowed |
| Range       | pointer| pointer| not-allowed |
| Color       | pointer| pointer| not-allowed |

## 💡 Accessibility Indicators

### High Contrast Mode
```
Border Width: 3px (increased from 2px)
Border Color: #495057 (darker gray)
```

### Reduced Motion
```
Transition: none
Animation: disabled
```

### Touch Devices
```
Active State = Hover Effect
Tap = Visual feedback
```

## 🧪 Testing Checklist

When implementing new inputs, verify:

- [ ] Normal state displays correctly
- [ ] Hover shows border color change
- [ ] Hover shows background color change
- [ ] Transition is smooth (0.2s)
- [ ] Focus overrides hover
- [ ] Disabled has no hover
- [ ] Valid state hover is green-tinted
- [ ] Invalid state hover is red-tinted
- [ ] Cursor changes appropriately
- [ ] Mobile touch shows feedback
- [ ] High contrast mode works
- [ ] Reduced motion respects preference

## 📝 Quick Implementation Template

### For New Input Class
```css
.your-new-input-class {
    border: 2px solid #e9ecef;
    border-radius: 12px;
    padding: 12px 16px;
    transition: all 0.3s ease;
}

.your-new-input-class:hover:not(:disabled):not(:focus) {
    border-color: #adb5bd;
    background-color: #f8f9fa;
}

.your-new-input-class:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
    outline: none;
}

.your-new-input-class:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
```

## 🎨 Design System Compliance

### Spacing
- Padding: 12px 16px (standard)
- Border radius: 12px (rounded)
- Border width: 2px (medium)

### Typography
- Font size: 15px-16px
- Font weight: 400-500
- Line height: 1.5

### Effects
- Transition: 0.2-0.3s ease
- Box shadow: 0 0 0 0.2rem rgba(...)
- Transform scale: 1.05-1.1

---

**Legend:**
- ✨ = Hover effect applied
- 👁 = Toggle visibility button
- 👆 = Pointer cursor
- 🚫 = Not allowed cursor
- ✓ = Valid
- ⚠ = Invalid
- ▓▓ = Light color
- ██ = Dark color

---

*Visual Reference Guide*
*Created: October 11, 2025*
