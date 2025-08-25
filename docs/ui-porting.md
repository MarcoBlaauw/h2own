# UI Porting Guide (React → SvelteKit + Tailwind)

## Libraries to use
- SvelteKit
- Tailwind CSS
- lucide icons for Svelte: `lucide-svelte`
- (Optional) shadcn-svelte or Skeleton UI later — for MVP, plain Tailwind is fine.

## Map of components
- `Card`, `CardHeader`, `CardContent`, `CardTitle` → Tailwind divs with classes.
- Icons: `lucide-react` → `lucide-svelte` imports.
- Alerts: Tailwind boxes (`rounded bg-... text-...`).
- Buttons: Tailwind (`px-3 py-1 rounded bg-blue-100 text-blue-700`).

## SvelteKit file layout
- `web/src/routes/+layout.svelte` → shell, fonts, global styles
- `web/src/routes/+page.svelte` → main dashboard (port MVP here)
- Optional: split sections into components:
  - `lib/components/ChemistryTiles.svelte`
  - `lib/components/EnvironmentCard.svelte`
  - `lib/components/RecommendationsList.svelte`
  - `lib/components/QuickTestForm.svelte`

## State and logic
- Replace React `useState` with Svelte local `let` variables and derived values.
- `useEffect` → reactive statements `$:` that recompute when dependencies change.
- Keep the same calculation logic (recommendations).

## Tailwind classes
Reuse the same Tailwind classes from the React MVP. Minimal changes.

## Icons
```svelte
<script>
  import { Droplets, Beaker, Cloud, Thermometer, Sun, AlertTriangle, CheckCircle, TrendingUp, Settings, Activity } from 'lucide-svelte';
</script>
