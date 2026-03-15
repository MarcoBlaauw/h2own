# Icon system decision (web)

## Chosen icon set and license

- **Primary family:** `@tabler/icons-svelte` (Tabler Icons) for shared UI and semantic weather glyphs where suitable.
- **License:** **MIT** (permissive; compatible with commercial and OSS distribution).
- **Svelte compatibility:** first-class Svelte components, tree-shakeable ESM imports, and direct sizing/stroke props for consistent rendering.
- **Weather fallback during migration:** existing Weather Icons font/CSS may be used only as temporary fallback through the shared wrapper (`fallbackClass`) if any unmigrated weather glyph remains.

## Stroke/fill strategy

- Default to **stroke icons** for clarity and consistency with current UI density.
- Standard stroke width: **1.75** (wrapper default), adjustable for special emphasis.
- Filled variants should be used sparingly for stateful or high-emphasis contexts only.

## Size grid

Use a constrained size ramp to keep rhythm aligned with typography and spacing tokens:

- `16` — inline metadata rows, compact labels.
- `20` — default card/action icon size.
- `24` — headings, hero statistics, or primary callouts.

These are exposed as allowed `size` values in the shared `Icon.svelte` wrapper.

## Color behavior

- Icons should inherit visual color from the component context via `currentColor` and token classes (e.g., `text-content-primary`, `text-content-secondary`).
- Avoid hard-coded hex values in icon usage.
- Theme changes (light/dark/custom token sets) should recolor icons automatically.

## Migration path

1. Introduce shared wrapper (`web/src/lib/components/ui/Icon.svelte`) that supports:
   - Tabler component rendering.
   - optional Weather Icons fallback class while migration is in progress.
2. Migrate high-impact weather card first (`WeatherQualityCard.svelte`).
3. Migrate one non-weather card as a reference pattern (`PoolSummaryCard.svelte`).
4. After all Weather Icons usages are removed:
   - remove `web/static/font/` Weather Icons font assets.
   - remove `@import './lib/styles/weather-icons.css'` from `web/src/app.css`.
   - remove Weather Icons asset sync scripts/dependency from `web/package.json`.
