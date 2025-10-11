# Theme and Styling Review

## Current setup

- Tailwind CSS is configured in `tailwind.config.ts` with `darkMode: 'class'` and the Skeleton Labs Tailwind plugin enabled. The only custom extension is a shared `card` shadow, so most styling tokens come from Skeleton. A single custom theme (`h2own`) is registered via the plugin.【F:web/tailwind.config.ts†L1-L23】
- The custom theme definition simply spreads the built-in `wintry` theme from Skeleton and overrides a handful of font and radius variables. Dark-mode overrides only flip the base font color, leaving the rest of the palette identical to the `wintry` preset.【F:web/src/lib/themes/h2own.ts†L1-L21】
- The app template sets `data-theme="h2own"` on `<body>` at start-up. The theme switcher enforces that attribute, toggles the `dark` class on `<html>`, and persists the preference in `localStorage`.【F:web/src/app.html†L1-L11】【F:web/src/lib/components/ThemeSwitcher.svelte†L1-L58】

## How styling is applied

- Layout primitives such as the header, footer, cards, and forms lean heavily on Skeleton utility classes like `btn`, `input`, and `preset-filled-*` variants. These utilities derive their colors from the active Skeleton theme tokens, so they only change when the theme provides matching CSS variables.【F:web/src/lib/components/layout/AppHeader.svelte†L18-L63】【F:web/src/lib/components/QuickTestForm.svelte†L57-L123】【F:web/src/lib/components/ui/Card.svelte†L5-L11】
- Tailwind `dark:` modifiers are sprinkled through components to adjust text and border colors, but because many background and border values come from Skeleton presets, the visual delta between light and dark is small. The shared palette is effectively the `wintry` preset regardless of mode, which explains why toggling the switch yields only minor differences.【F:web/src/lib/components/QuickTestForm.svelte†L57-L123】
- No additional Skeleton themes are defined, and there is no Tailwind color extension that would let us style components independently of Skeleton’s presets. As a result, the styling layer is split between Tailwind layout utilities and Skeleton theme tokens, leading to brittle overrides and inconsistent theming.

## Recommendations for a Tailwind-first theming strategy

1. **Define CSS variables for light and dark palettes.** Create a small theme stylesheet that sets CSS custom properties (e.g., `--color-bg`, `--color-surface`, `--color-primary`) on `:root` and `.dark`. These variables should map to the desired brand colors for both modes, independent of Skeleton presets.
2. **Expose the palette to Tailwind.** Update `tailwind.config.ts` to extend the `colors`, `backgroundColor`, `borderColor`, and `boxShadow` utilities so they reference the new CSS variables via helper functions (for example, using Tailwind’s `withOpacityValue` pattern). Remove the Skeleton plugin once all components stop relying on its utilities.
3. **Refactor shared components to Tailwind utilities.** Replace Skeleton-specific classes (`btn`, `preset-filled-*`, `input`, `card`, etc.) with Tailwind utility compositions or extracted component classes (e.g., using `@apply` in a `components.css` layer). This ensures that styles derive from the Tailwind palette and respond correctly to the `dark` class without additional data attributes.
4. **Simplify the theme switcher.** Keep persisting the `dark` class on `<html>` for Tailwind dark mode, but drop the body `data-theme` attribute once Skeleton is removed. Consider wiring the initial mode to server-rendered user preferences to avoid a flash of incorrect theme.
5. **Audit screens for Skeleton dependencies.** As you touch each route, replace Skeleton token usage with Tailwind equivalents. Prioritize high-visibility areas (layout header/footer, dashboard cards, forms) to ensure the new palette reads correctly in both light and dark modes.
6. **Add regression coverage.** After the refactor, capture Playwright visual snapshots for light and dark themes to catch future regressions, and document the palette in the design system docs so future components stay Tailwind-first.

Following these steps will centralize color and component styling inside Tailwind, give the dark theme distinct colors, and remove the dependency on Skeleton presets that currently limit how much the UI changes when the theme toggles.

## Extending semantic tokens and component utilities

1. **Start with the tokens.** Introduce new CSS variables in [`src/lib/styles/tokens.css`](../web/src/lib/styles/tokens.css) with matching light/dark values. Keep using RGB tuples so the Tailwind opacity helpers continue to work. For radii/spacing/typography additions, prefer semantic names (e.g., `--radius-2xl`) over raw pixel counts.
2. **Wire them into Tailwind.** Update [`tailwind.config.ts`](../web/tailwind.config.ts) by appending to the `colorTokens` map or the relevant `theme.extend` block. Reuse the `withOpacityValue` helper for color-like tokens so new utilities such as `bg-accent-strong` behave consistently.
3. **Codify reusable component classes.** When multiple features need the same pattern (buttons, surfaces, inputs), add an entry inside the `@layer components` block of [`src/app.css`](../web/src/app.css) that composes Tailwind utilities with the new tokens. Avoid duplicating literal color codes in Svelte components; instead, reference the shared class.
4. **Validate both themes.** Run `pnpm --filter web lint` followed by `pnpm --filter web test:visual` (with `--update-snapshots` if intentionally changing the UI) so the lint rule coverage and Playwright baseline screenshots reflect the new styles.

## Token reference

The new design tokens live in `web/src/lib/styles/tokens.css` and are consumed globally via `src/app.css` and Tailwind utility extensions. Each color is expressed as an RGB tuple for Tailwind’s opacity helpers but is documented here in hex for readability.

### Semantic colors

| Token | Light | Dark | Notes |
| --- | --- | --- | --- |
| `--color-bg-surface` | `#f8fafc` | `#0f172a` | Base page background |
| `--color-bg-subtle` | `#f1f5f9` | `#161e31` | Panels, muted surfaces |
| `--color-bg-inset` | `#e2e8f0` | `#1e293b` | Inputs, inset areas |
| `--color-bg-raised` | `#ffffff` | `#1e293b` | Cards, overlays |
| `--color-content-primary` | `#0f172a` | `#e2e8f0` | Default text |
| `--color-content-secondary` | `#475569` | `#94a3b8` | Secondary text |
| `--color-content-muted` | `#64748b` | `#64748b` | Placeholder/help text |
| `--color-content-inverse` | `#f8fafc` | `#0f172a` | Text on accent surfaces |
| `--color-border` | `#cbd5e1` | `#334155` | Default border/divider |
| `--color-border-strong` | `#94a3b8` | `#475569` | Emphasised border |
| `--color-accent` | `#38bdf8` | `#38bdf8` | Brand accent |
| `--color-accent-strong` | `#0ea5e9` | `#0284c7` | Hover/active accent |
| `--color-accent-contrast` | `#0f172a` | `#0f172a` | Text on accent |
| `--color-success` | `#22c55e` | `#22c55e` | Positive state |
| `--color-warning` | `#f59e0b` | `#f59e0b` | Caution state |
| `--color-danger` | `#f87171` | `#f87171` | Critical/destructive state |
| `--color-info` | `#3b82f6` | `#60a5fa` | Informational alerts |

### Typography tokens

| Token | Value |
| --- | --- |
| `--font-family-sans` | `Inter, SF Pro Display, Segoe UI, system-ui, sans-serif` |
| `--font-family-serif` | `Georgia, Times New Roman, serif` |
| `--font-family-mono` | `JetBrains Mono, SFMono-Regular, Menlo, monospace` |
| `--font-size-xs` | `0.75rem` |
| `--font-size-sm` | `0.875rem` |
| `--font-size-md` | `1rem` |
| `--font-size-lg` | `1.125rem` |
| `--font-size-xl` | `1.25rem` |
| `--font-size-2xl` | `1.5rem` |
| `--font-weight-regular` | `400` |
| `--font-weight-medium` | `500` |
| `--font-weight-semibold` | `600` |
| `--font-weight-bold` | `700` |
| `--line-height-tight` | `1.25` |
| `--line-height-normal` | `1.5` |
| `--line-height-relaxed` | `1.75` |

### Radii tokens

| Token | Value |
| --- | --- |
| `--radius-xs` | `0.25rem` |
| `--radius-sm` | `0.5rem` |
| `--radius-md` | `0.75rem` |
| `--radius-lg` | `1rem` |
| `--radius-xl` | `1.5rem` |
| `--radius-pill` | `9999px` |

### Spacing tokens

| Token | Value |
| --- | --- |
| `--space-2xs` | `0.25rem` |
| `--space-xs` | `0.5rem` |
| `--space-sm` | `0.75rem` |
| `--space-md` | `1rem` |
| `--space-lg` | `1.5rem` |
| `--space-xl` | `2rem` |
| `--space-2xl` | `3rem` |
