```markdown
# Design System Strategy: Modern Clubroom Editorial

## 1. Overview & Creative North Star
**The Creative North Star: "The Stoic Architect"**
This design system rejects the "friendly" ubiquity of modern SaaS. It moves away from the bubbly, rounded, and over-explained, opting instead for a visual language that is architectural, decisive, and quietly elite. We are building a digital environment that feels like a private members' club at midnight—sophisticated, high-stakes, and unapologetically masculine.

The "Modern Clubroom Editorial" aesthetic is achieved through **Aggressive Precision**. We break the standard grid not through chaos, but through intentional asymmetry and "The Heavy Bleed"—allowing high-contrast typography to dominate the space while technical data sits in the periphery like a finely tuned instrument. We do not use "cues" to help the user; we provide "commands" through structure.

---

## 2. Colors & Tonal Depth
The palette is rooted in the dark, heavy atmosphere of navy and charcoal, punctured by the clinical precision of cream and the visceral "Oxblood" accent.

### Surface Hierarchy & Nesting
We do not use lines to separate thoughts. We use **Tonal Layering**.
- **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Boundaries are defined solely by shifting between `surface-container-lowest` (#020F1E) and `surface-container-high` (#1E2B3B).
- **Nesting:** To create focus, place a `surface-container-highest` (#283646) card inside a `surface-container-low` (#0F1C2C) section. This creates "structural gravity" without the clutter of strokes.
- **The Glass & Gradient Rule:** For floating navigation or modal overlays, use **Glassmorphism**. Apply `surface-variant` (#283646) at 70% opacity with a `20px` backdrop blur. This ensures the UI feels like a physical layer of tinted glass rather than a flat digital sticker.
- **Signature Textures:** For primary CTAs and Hero backgrounds, use a subtle linear gradient from `primary` (#C6C7C3) to `primary-container` (#242724) at a 135-degree angle. This mimics the sheen of brushed steel or heavy cardstock.

---

## 3. Typography: The Editorial Voice
Typography is the primary vehicle for the "Cynical Editorial" vibe. It should feel like a high-end broadside newspaper updated for a technical age.

- **Display & Headlines (Newsreader):** Use `display-lg` and `headline-lg` to assert dominance. These should be set with tight letter-spacing (-0.02em) to feel authoritative. The high-contrast serif evokes a sense of history and "no-nonsense" truth.
- **Technical Data (Space Grotesk):** All `label` styles use Space Grotesk. This is our "instrumentation" font. It is used for P.E.N.S. metrics (Performance, Endurance, Nutrition, Sleep) to provide a stark, cold contrast to the serif headlines.
- **Body (Work Sans):** Used for utility. It is clean, legible, and stays out of the way of the more expressive typefaces.

---

## 4. Elevation & Depth
In this system, "Up" does not mean "Shadow." It means **"Contrast."**

- **The Layering Principle:** Depth is achieved by stacking the `surface-container` tiers. A `surface-container-highest` element is perceived as being "closer" to the user than a `surface-dim` background.
- **Ambient Shadows:** Shadows are a last resort. If required for a floating state (like a context menu), use a shadow color tinted with `on-secondary-fixed-variant` (#3C475D) at 10% opacity with a `40px` blur and `0px` spread. It should feel like a soft glow, not a drop shadow.
- **The "Ghost Border" Fallback:** If accessibility requires a container edge, use the `outline-variant` (#45474D) at **15% opacity**. This creates a "suggestion" of a boundary that disappears into the background.

---

## 5. Components: Precision Implements

### Buttons
All buttons have **0px border radius**. Sharp corners only.
- **Primary:** `primary` (#C6C7C3) background with `on-primary` (#2F312E) text. No border.
- **Secondary:** `secondary-container` (#3E4960) background. 
- **Tertiary (The "Oxblood" Action):** Use `tertiary` (#FFB4A8) text with a `tertiary-container` (#550000) subtle underline. Reserved for high-stakes P.E.N.S. alerts.

### Input Fields
- **Base:** Use `surface-container-lowest` (#020F1E) as the field background. 
- **State:** On focus, do not use a glow. Instead, change the background to `surface-bright` (#2D3A4A) and the label to `tertiary` (Oxblood).
- **Shape:** Rectangular, sharp, and technical.

### Cards & Lists
- **The Divider Ban:** Never use `hr` tags or divider lines. Use `spacing-8` (2.75rem) of vertical white space to separate list items, or alternate background colors between `surface-container-low` and `surface-container-high`.
- **P.E.N.S. Data Chips:** Use `label-md` in Space Grotesk. Backgrounds should be `secondary-container` (#3E4960) with 0px radius.

### P.E.N.S. Performance Graphs
- Use `tertiary` (#FFB4A8) for "Endurance" and "Performance" peaks. 
- Use `primary` (#C6C7C3) for "Sleep" and "Nutrition" baselines.
- Background grid lines must be `outline-variant` at 5% opacity.

---

## 6. Do’s and Don’ts

### Do
- **Use Sharp Edges:** Everything is 0px radius. If it looks "soft," it’s wrong.
- **Embrace Negative Space:** If a screen feels "empty," leave it. It’s not empty; it’s "uncluttered."
- **Leap with Type Scale:** Don't be afraid to put a `display-lg` headline next to a `label-sm` technical note. The contrast is the point.
- **Use "Oxblood" Sparingly:** It is a surgical tool, not a paint bucket. Use it for errors, critical metrics, or the single most important CTA on a page.

### Don’t
- **No Rounded Corners:** Do not use `8px` or even `2px`. If the token says `lg`, the value is still `0px`.
- **No "Bubbly" Language:** Avoid "Got it!" or "Oops!" Use "Confirmed" or "System Error."
- **No Icons without Labels:** This isn't a playground. If you use an icon, it must be accompanied by technical `label-sm` text.
- **No Flat Grids:** Avoid a 3-column "card" layout. Offset the second card by `spacing-10` to create an editorial, asymmetrical flow.