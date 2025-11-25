# ThriftSpot Design System v4.0

A comprehensive design system following Dieter Rams principles, Nielsen's usability heuristics, and Material Design guidelines.

## 🎯 Design Principles

### Dieter Rams: "Less, but better"
- **Innovative**: Creative treasure-hunt theme with dual modes
- **Useful**: Every element serves a purpose
- **Aesthetic**: Beautiful gradients and thoughtful color palettes
- **Understandable**: Clear visual hierarchy and intuitive navigation
- **Honest**: Authentic materials and transparent interactions
- **Unobtrusive**: Design supports content, doesn't overwhelm
- **Long-lasting**: Timeless typography and scalable system
- **Thorough**: Consistent down to the smallest detail
- **Environmentally friendly**: Optimized performance
- **Minimal**: Only what's necessary

### Nielsen's Usability Heuristics
- **Visibility**: Clear system status with loading states and feedback
- **Match real world**: Familiar patterns and conventions
- **User control**: Easy navigation and reversible actions
- **Consistency**: Unified design language across all screens
- **Error prevention**: Clear form validation and helpful messages
- **Recognition**: Visual cues instead of memorization
- **Flexibility**: Works for novice and expert users
- **Aesthetic**: Minimalist design reduces cognitive load
- **Recovery**: Clear error messages with solutions
- **Documentation**: Tooltips and helpful hints

### Material Design
- **Material as metaphor**: Surfaces, shadows, and elevation
- **Bold, graphic, intentional**: Strong visual hierarchy
- **Motion provides meaning**: Purposeful animations
- **Flexible foundation**: Responsive grid system
- **Cross-platform**: Works on all devices

---

## 🎨 Color System

### Primary Brand Colors
```css
--primary-50: #f5f3ff
--primary-100: #ede9fe
--primary-200: #ddd6fe
--primary-300: #c4b5fd
--primary-400: #a78bfa
--primary-500: #667eea   /* Main brand color */
--primary-600: #5a67d8
--primary-700: #4c51bf
--primary-800: #434190
--primary-900: #3c366b
```

### Neutral Grays
```css
--gray-50: #f9fafb
--gray-100: #f3f4f6
--gray-200: #e5e7eb
--gray-300: #d1d5db
--gray-400: #9ca3af
--gray-500: #6b7280
--gray-600: #4b5563
--gray-700: #374151
--gray-800: #1f2937
--gray-900: #111827
```

### Semantic Colors
```css
/* Success */
--success-light: #d1fae5
--success: #10b981
--success-dark: #059669

/* Error */
--error-light: #fee2e2
--error: #ef4444
--error-dark: #dc2626

/* Warning */
--warning-light: #fef3c7
--warning: #f59e0b
--warning-dark: #d97706

/* Info */
--info-light: #dbeafe
--info: #3b82f6
--info-dark: #2563eb
```

### Theme-Specific Colors

**Scan Mode** (Periscope Modern + Treasure Map)
```css
--scan-hull-dark: #1a2332
--scan-hull-medium: #2d3e50
--scan-hull-light: #3d5467
--scan-neon-cyan: #00e5ff
--scan-neon-purple: #b388ff
--scan-neon-pink: #ff4081
--treasure-gold: #ffd700
--treasure-red-x: #d32f2f
```

**Find Mode** (Brass & Compass)
```css
--brass-primary: #b8860b
--brass-light: #daa520
--brass-dark: #85621b
--brass-patina: #6b8e7f
--compass-ink: #2c2416
--parchment-aged: #f5f1e8
```

---

## 📝 Typography

### Font Families
```css
--font-primary: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
--font-mono: 'Roboto Mono', 'Courier New', monospace
```

**Why Lexend?**
- Designed specifically for readability
- Variable font for optimal performance
- Excellent for dyslexic readers
- Modern, clean, and professional

**Why Roboto Mono?**
- Perfect for code snippets and technical data
- Clear character distinction
- Matches Lexend's modern aesthetic

### Type Scale (Material Design)
```css
--text-xs: 0.75rem;      /* 12px */
--text-sm: 0.875rem;     /* 14px */
--text-base: 1rem;       /* 16px - minimum for mobile */
--text-lg: 1.125rem;     /* 18px */
--text-xl: 1.25rem;      /* 20px */
--text-2xl: 1.5rem;      /* 24px */
--text-3xl: 1.875rem;    /* 30px */
--text-4xl: 2.25rem;     /* 36px */
--text-5xl: 3rem;        /* 48px */
```

### Font Weights
```css
--font-light: 300
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Line Heights
```css
--leading-tight: 1.25    /* Headings */
--leading-normal: 1.5    /* Body text */
--leading-relaxed: 1.75  /* Long-form content */
```

### Letter Spacing
```css
--tracking-tight: -0.015em   /* Large headings */
--tracking-normal: 0         /* Body text */
--tracking-wide: 0.025em     /* Buttons, labels */
--tracking-wider: 0.05em     /* All caps text */
```

---

## 📏 Spacing System (8px Grid)

```css
--space-1: 0.25rem;      /* 4px */
--space-2: 0.5rem;       /* 8px */
--space-3: 0.75rem;      /* 12px */
--space-4: 1rem;         /* 16px */
--space-5: 1.25rem;      /* 20px */
--space-6: 1.5rem;       /* 24px */
--space-8: 2rem;         /* 32px */
--space-10: 2.5rem;      /* 40px */
--space-12: 3rem;        /* 48px */
--space-16: 4rem;        /* 64px */
--space-20: 5rem;        /* 80px */
```

**Usage Guidelines:**
- Use `--space-2` (8px) as the base unit
- Always use multiples of 4px for consistency
- Larger spacing for section breaks
- Smaller spacing for related items

---

## 🎭 Elevation System (Material Design)

```css
--elevation-0: none
--elevation-1: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)
--elevation-2: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)
--elevation-3: 0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)
--elevation-4: 0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22)
--elevation-5: 0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22)
```

**When to use:**
- `elevation-0`: Flat elements (text, icons)
- `elevation-1`: Subtle lift (input focus)
- `elevation-2`: Cards, containers
- `elevation-3`: Dropdown menus, tooltips
- `elevation-4`: Modals, dialogs
- `elevation-5`: Navigation drawer

---

## 🔘 Border Radius

```css
--radius-sm: 0.25rem;    /* 4px - Subtle rounding */
--radius-base: 0.5rem;   /* 8px - Standard buttons */
--radius-lg: 0.75rem;    /* 12px - Large buttons */
--radius-xl: 1rem;       /* 16px - Cards */
--radius-2xl: 1.5rem;    /* 24px - Feature cards */
--radius-full: 9999px;   /* Fully rounded - Pills, avatars */
```

---

## ⚡ Transitions

```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-mode: 600ms cubic-bezier(0.4, 0, 0.2, 1)
```

**Usage:**
- `fast`: Hover states, focus rings
- `base`: Button presses, dropdown opens
- `slow`: Page transitions, complex animations
- `mode`: Theme switching (Scan ↔ Find mode)

---

## 🧩 Component Library

### Buttons

**Variants:**
```html
<!-- Primary Button -->
<button class="btn btn-primary">Buy Now</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Make Offer</button>

<!-- Ghost Button -->
<button class="btn btn-ghost">Cancel</button>
```

**Sizes:**
```html
<button class="btn btn-sm">Small</button>
<button class="btn">Default</button>
<button class="btn btn-lg">Large</button>
```

**States:**
- `:hover` - Lift + shadow increase
- `:active` - Scale down slightly
- `:disabled` - 50% opacity, no pointer
- `:focus-visible` - 3px outline

### Form Elements

**Input Fields:**
```html
<label class="label">Email Address</label>
<input type="email" class="input" placeholder="you@example.com">
<span class="helper-text">We'll never share your email</span>
```

**Select Dropdowns:**
```html
<select class="select">
  <option>Choose an option</option>
  <option>Option 1</option>
</select>
```

**Textarea:**
```html
<textarea class="textarea" placeholder="Enter description..."></textarea>
```

### Cards

```html
<div class="card">
  <div class="card-header">
    <h3>Card Title</h3>
  </div>
  <div class="card-body">
    <p>Card content goes here</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

### Badges

```html
<span class="badge badge-primary">Primary</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-error">Error</span>
<span class="badge badge-warning">Warning</span>
```

---

## 📱 Layout System

### Containers

```html
<div class="container">Max 1280px</div>
<div class="container-sm">Max 640px</div>
<div class="container-md">Max 768px</div>
<div class="container-lg">Max 1024px</div>
```

### Grid

```html
<div class="grid grid-cols-4 gap-4">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
  <div>Column 4</div>
</div>
```

### Flexbox

```html
<div class="flex items-center justify-between gap-4">
  <div>Left</div>
  <div>Right</div>
</div>
```

---

## 🎯 Utility Classes

### Spacing
```css
.m-0, .mt-4, .mb-6, .mx-auto, .p-4, .py-8, etc.
```

### Typography
```css
.text-xs, .text-base, .text-2xl
.font-normal, .font-semibold, .font-bold
.text-center, .text-left, .text-right
.text-gray-600, .text-primary, .text-error
```

### Display
```css
.hidden, .block, .inline-block, .flex, .grid
```

---

## ♿ Accessibility

### Focus States
All interactive elements have clear `:focus-visible` states:
```css
*:focus-visible {
    outline: 3px solid var(--primary-500);
    outline-offset: 2px;
}
```

### Color Contrast
- All text meets WCAG 2.1 AA standards (4.5:1 minimum)
- Large text (18px+) meets AAA standards (3:1)

### Screen Reader Support
```html
<span class="sr-only">Screen reader only text</span>
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}
```

---

## 📐 Responsive Breakpoints

```css
/* Mobile First Approach */
/* Base styles: Mobile (0-767px) */

@media (min-width: 768px)  { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1280px) { /* Large Desktop */ }
```

---

## 🎨 Theme Modes

### Scan Mode (Dark Theme)
- Dark hull blues (#1a2332, #2d3e50)
- Neon accents (cyan, purple, pink)
- Periscope shimmer effects
- Treasure map elements

### Find Mode (Light Theme)
- Warm parchment (#f5f1e8)
- Brass accents (#b8860b)
- Compass and ruler details
- Editorial aesthetic

**Switching Modes:**
```javascript
document.body.classList.toggle('find-mode-active');
```

---

## 📁 File Structure

```
public/css/
├── thriftspot-design-system.css    # Core design system
└── thriftspot-theme.css            # Theme-specific styles (Scan/Find modes)
```

**Import Order:**
```html
<!-- 1. Design System Foundation -->
<link rel="stylesheet" href="css/thriftspot-design-system.css">

<!-- 2. Theme-Specific Styles (optional) -->
<link rel="stylesheet" href="css/thriftspot-theme.css">

<!-- 3. Page-Specific Styles -->
<style>/* Custom styles */</style>
```

---

## 🚀 Getting Started

### 1. Link the Design System
```html
<head>
  <link rel="stylesheet" href="css/thriftspot-design-system.css">
</head>
```

### 2. Use Design Tokens
```css
/* Instead of this: */
.my-element {
  font-size: 18px;
  color: #667eea;
  padding: 16px;
}

/* Do this: */
.my-element {
  font-size: var(--text-lg);
  color: var(--primary-500);
  padding: var(--space-4);
}
```

### 3. Use Utility Classes
```html
<!-- Instead of inline styles -->
<div style="display: flex; align-items: center; gap: 16px;">

<!-- Use utility classes -->
<div class="flex items-center gap-4">
```

---

## ✅ Best Practices

### DO:
- ✅ Use design tokens for all values
- ✅ Use utility classes for common patterns
- ✅ Follow the 8px spacing grid
- ✅ Test on mobile devices
- ✅ Check accessibility with keyboard navigation
- ✅ Use semantic HTML elements
- ✅ Test with reduced motion settings
- ✅ Verify color contrast ratios

### DON'T:
- ❌ Use arbitrary values (use tokens instead)
- ❌ Create one-off inline styles
- ❌ Ignore mobile breakpoints
- ❌ Use font sizes below 16px on mobile (causes zoom)
- ❌ Forget `:focus-visible` states
- ❌ Use color alone to convey information
- ❌ Nest more than 3 levels deep in CSS

---

## 📊 Performance

### Optimizations:
- **Variable fonts**: Lexend uses a single file for all weights
- **CSS custom properties**: Enable dynamic theming without JS
- **Mobile-first**: Smaller base styles, enhance up
- **8px grid**: Reduces layout thrashing
- **Minimal animations**: Respect `prefers-reduced-motion`

### Loading Strategy:
```html
<!-- Preload critical fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preload" href="fonts/lexend.woff2" as="font" crossorigin>
```

---

## 🔄 Migration Guide

### From Old System to New:

**1. Replace hardcoded colors:**
```css
/* Old */
color: #667eea;

/* New */
color: var(--primary-500);
```

**2. Replace font stacks:**
```css
/* Old */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* New */
font-family: var(--font-primary);
```

**3. Replace spacing:**
```css
/* Old */
padding: 20px;
margin-bottom: 15px;

/* New */
padding: var(--space-5);
margin-bottom: var(--space-4);
```

**4. Use utility classes:**
```html
<!-- Old -->
<div style="display: flex; gap: 20px; padding: 30px;">

<!-- New -->
<div class="flex gap-5 p-8">
```

---

## 📚 Resources

### Design Tools
- [Figma Component Library](#) (Coming soon)
- [Storybook Documentation](#) (Coming soon)

### Inspiration
- [Dieter Rams: 10 Principles](https://www.vitsoe.com/us/about/good-design)
- [Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Material Design Guidelines](https://m3.material.io/)
- [Lexend Font](https://www.lexend.com/)

### Testing
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WAVE Accessibility Tool](https://wave.webaim.org/)
- [Lighthouse (Chrome DevTools)](https://developers.google.com/web/tools/lighthouse)

---

## 🤝 Contributing

### Adding New Components:
1. Follow existing naming conventions
2. Use design tokens exclusively
3. Ensure accessibility (WCAG AA)
4. Test on mobile and desktop
5. Document usage with examples
6. Update this file

### Proposing Changes:
1. Open an issue describing the problem
2. Suggest solution with code examples
3. Get feedback from team
4. Implement with tests
5. Update documentation

---

## 📝 Changelog

### v4.0 (Current)
- ✨ Complete design system overhaul
- 🎨 Lexend + Roboto Mono typography
- 📐 8px spacing grid system
- ♿ WCAG 2.1 AA compliance
- 🎭 Material Design elevation
- 🔧 Comprehensive utility classes
- 📱 Mobile-first responsive design
- 🎨 Semantic color system
- ⚡ Performance optimizations

### v3.0 (Previous)
- Dual-mode theming (Scan/Find)
- Periscope + Treasure Map aesthetic
- Brass & Compass design language

---

## 📄 License

This design system is part of the ThriftSpot project.

---

**Questions?** Contact the design team or open an issue.

**Last Updated:** October 2025
