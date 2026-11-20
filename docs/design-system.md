# Design system

## Character

Dark-first, editorial, and calm. The interface should read as a credible security tool. Risk and verification colors describe evidence states, not decoration. Phase 0 uses a restrained wordmark and one visual accent.

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

## Typography and layout

- Display: system Arial/Helvetica stack, weight 600, tight tracking. Use fluid sizing on large headings.
- Body: the same dependable system stack, comfortable line height, and off-white contrast.
- Content width: `max-w-7xl` shell, with text measures constrained per section.
- Spacing: 4px base rhythm; major section gaps should use 32–96px depending on viewport.
- Radii: small `6px`, medium `12px`, large `20px`. Use borders sparingly.
- Mobile: content remains readable from 320px; use fluid typography and responsive horizontal padding.

## Motion and accessibility

- Use motion only to clarify state or hierarchy. Default transitions should be about 180–240ms, ease-out, and subtle.
- Honor `prefers-reduced-motion`; never depend on animation to convey a result.
- Keep semantic headings, visible keyboard focus on future controls, and sufficient contrast for text and state labels.
- Avoid gradients, glow, glass effects, fake metrics, and decorative controls that imply unavailable features.

shadcn/ui, Lucide, and Motion for React are candidates for later interactive phases. They are intentionally absent until a screen needs them.
