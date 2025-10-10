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
