# Changelog

## [Unreleased]
### Added
- Documented how to extend semantic tokens and Tailwind component classes in the engineering theme review and the frontend onboarding guide.
- Captured Playwright visual regression baselines for light and dark dashboards and wired a dedicated `npm run test:visual` command.

### Changed
- Continuous integration now runs `npm run lint`, `npm run check`, Playwright visual tests, and `npm audit` on every pull request to guard theme regressions and dependency risk.

### Breaking Changes
- Playwright visual snapshots are required when altering theming. Update baselines with `npm run test:visual -- --update-snapshots` when making intentional visual changes.

### Testing Notes
- Frontend contributors should run `npm run lint`, `npm run check`, and `npm run test:visual` locally before submitting PRs to refresh semantic token coverage and image baselines.
