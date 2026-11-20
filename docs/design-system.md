# Design system

## Character

Dark-first, editorial, and calm. The landing page resembles an investigation workspace, with a warm paper offer, annotated warning signs, and asymmetrical chapter layouts. Risk and verification colors describe evidence states, not decoration.

## Tokens

The source of truth for implemented colors, type families, and radii is `client/styles.css` in the Tailwind `@theme` block.

| Token             | Value     | Use                                   |
| ----------------- | --------- | ------------------------------------- |
| `canvas`          | `#101316` | Primary background                    |
| `surface`         | `#191d20` | Future panels                         |
| `ink`             | `#f2efe8` | Primary text                          |
| `ink-muted`       | `#bcbab5` | Supporting text                       |
| `ink-subtle`      | `#858b8a` | Low-emphasis labels                   |
| `line`            | `#303639` | Dividers and borders                  |
| `accent` / `risk` | `#e67d70` | Brand emphasis and future risk states |
| `verified`        | `#8eae97` | Future confirmed signals              |
| `paper`           | `#e8e3d7` | Fictional offer document              |
| `paper-ink`       | `#272a29` | Document text                         |

## Typography and layout

- Display: system Georgia/Times serif, weight 400, tight tracking. Use fluid sizing on large headings.
- Body: Arial/Helvetica system sans, with comfortable line height and off-white contrast.
- Metadata: system Courier monospace for document labels and investigation annotations.
- Content width: a 1440px shell, with text measures constrained per section.
- Spacing: 4px base rhythm; major section gaps should use 32–96px depending on viewport.
- Radii: small `6px`, medium `12px`, large `20px`. Use borders sparingly.
- Mobile: content remains readable from 320px; use fluid typography and responsive horizontal padding.

## Motion and accessibility

- Use motion only to clarify state or hierarchy. Default transitions should be about 180–240ms, ease-out, and subtle.
- Honor `prefers-reduced-motion`; never depend on animation to convey a result.
- Keep semantic headings, visible keyboard focus on future controls, and sufficient contrast for text and state labels.
- Avoid gradients, glow, glass effects, fake metrics, and decorative controls that imply unavailable features.

The fictional offer uses native buttons for mouse, touch, and keyboard input. Its progress indicator reports viewed notes, never a safety score. The evidence relationship view uses SVG only for the lines; native buttons provide node selection and a text description explains the relationships. Coral solid lines and labels distinguish suspicious signals from dashed neutral, unverified relationships. shadcn/ui, Lucide, and Motion for React remain candidates for later phases; this page does not need them.
