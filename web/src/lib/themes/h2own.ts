import { getThemeProperties, type CustomThemeConfig } from '@skeletonlabs/tw-plugin';

const base = getThemeProperties('wintry');

export const h2ownTheme: CustomThemeConfig = {
  name: 'h2own',
  properties: {
    ...base,
    '--theme-font-family-base': "'Inter', 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
    '--theme-font-family-heading': "'Inter', 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
    '--theme-font-color-base': '30 41 59',
    '--theme-font-color-dark': '248 250 252',
    '--theme-rounded-base': '12px',
    '--theme-rounded-container': '16px',
    '--theme-border-base': '1px'
  },
  properties_dark: {
    '--theme-font-color-base': '248 250 252',
    '--theme-font-color-dark': '248 250 252'
  }
};

export default h2ownTheme;
