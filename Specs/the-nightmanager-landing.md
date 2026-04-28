# Spec: X Styled Landing Page

## Overview

Style the nightmanager landing page to match X's design aesthetic — a dark theme with clean typography, subtle animations, and professional SaaS look-and-feel.

## Design System

### Colors (OKLCH / Tailwind v4 compatible)

```css
:root {
  /* Background - dark charcoal */
  --color-bg: oklch(0.19 264);
  --color-bg-elevated: oklch(0.22 264);
  
  /* Surface */
  --color-surface: oklch(0.97 0.008 264);
  --color-surface-muted: oklch(0.85 0.008 264);
  
  /* Text */
  --color-text-primary: oklch(0.97 0.008 264);
  --color-text-secondary: oklch(0.7 0.008 264);
  --color-text-muted: oklch(0.5 0.008 264);
  
  /* Accent - blue/violet CTA */
  --color-accent: oklch(0.6 0.2 270);
  --color-accent-hover: oklch(0.7 0.2 270);
  
  /* Borders */
  --color-border: oklch(0.3 264);
  --color-border-subtle: oklch(0.25 264);
}
```

### Typography

```css
:root {
  /* Font families - Inter for body, Cal Sans for display */
  --font-display: "Cal Sans", "Inter", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  
  /* Sizing */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  
  /* Line heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

### Spacing System

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;
}
```

### Effects

```css
:root {
  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.3);
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}
```

## Page Structure

### 1. Header (sticky)
- Logo/site title left-aligned
- Navigation: Features | Tools | Docs | Nightmanager
- GitHub link right-aligned
- Background: semi-transparent dark with blur

### 2. Hero Section
- Main headline: "The Nightmanager"
- Subheadline: description of what nightmanager do
- CTA button: "Get Started" (links to README)
- Secondary link: "View on GitHub"

### 3. Features Section
- 3-column grid of feature cards
- Each card: icon, title, description
- Features: Finder, Oracle, Worker, Manager capabilities

### 4. Tools Section
- Card grid for each subagent tool
- Each card: tool name, role, best-for use cases
- Reference existing README table

### 5. Nightmanager Section
- Brief description of autonomous workflow
- Link to docs/nightmanager.md

### 6. Footer
- Repository link
- Links to existing docs
- Copyright

## Animations

### Fade-in on scroll
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 0.5s ease forwards;
}
```

### Hover effects
- Cards: subtle lift (translateY -2px) + shadow increase
- Links: color shift to accent
- Buttons: background color shift

### Page load
- Staggered animation delays for sections
- 100ms delay between elements

## Responsive Breakpoints

```css
/* Mobile first */
.card-grid { grid-template-columns: 1fr; }

/* Tablet */
@media (min-width: 640px) {
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Desktop */
@media (min-width: 1024px) {
  .card-grid { grid-template-columns: repeat(3, 1fr); }
  .hero { text-align: left; }
}
```

## Content Sources

- Hero text: from README.md introduction
- Tool descriptions: from README.md tool section
- Feature descriptions: from docs/index.md

## Implementation Notes

1. Create `landing/` directory with:
   - `index.html` (entry point)
   - `styles.css` (all styles)
   - Optional: split into multiple files if needed

2. Use semantic HTML5 elements (header, nav, main, section, footer)

3. Include proper ARIA labels for accessibility

4. Ensure dark theme doesn't cause eye strain:
   - Sufficient contrast for text
   - Not pure black (#000) - use dark gray

5. Keep file size reasonable - inline critical CSS

## Validation

- HTML validates (no errors in W3C validator)
- Lighthouse accessibility score: 90+
- Page load under 3 seconds
- No console errors
- Works in Chrome, Firefox, Safari