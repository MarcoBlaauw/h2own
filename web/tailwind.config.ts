import type { Config } from 'tailwindcss';

const withOpacityValue =
  (variable: string) =>
  ({ opacityValue }: { opacityValue?: string } = {}) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${variable}) / ${opacityValue})`;
    }

    return `rgb(var(${variable}))`;
  };

const colorTokens = {
  surface: withOpacityValue('--color-bg-surface'),
  'surface-subtle': withOpacityValue('--color-bg-subtle'),
  'surface-inset': withOpacityValue('--color-bg-inset'),
  'surface-raised': withOpacityValue('--color-bg-raised'),
  'content-primary': withOpacityValue('--color-content-primary'),
  'content-secondary': withOpacityValue('--color-content-secondary'),
  'content-muted': withOpacityValue('--color-content-muted'),
  'content-inverse': withOpacityValue('--color-content-inverse'),
  accent: withOpacityValue('--color-accent'),
  'accent-strong': withOpacityValue('--color-accent-strong'),
  'accent-contrast': withOpacityValue('--color-accent-contrast'),
  success: withOpacityValue('--color-success'),
  warning: withOpacityValue('--color-warning'),
  danger: withOpacityValue('--color-danger'),
  info: withOpacityValue('--color-info'),
  border: withOpacityValue('--color-border'),
  'border-strong': withOpacityValue('--color-border-strong')
};

const config = {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: colorTokens,
      borderColor: {
        DEFAULT: withOpacityValue('--color-border'),
        strong: withOpacityValue('--color-border-strong')
      },
      ringColor: {
        DEFAULT: withOpacityValue('--color-accent'),
        accent: withOpacityValue('--color-accent')
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        raised: 'var(--shadow-raised)',
        card: 'var(--shadow-soft)'
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-pill)'
      },
      spacing: {
        '2xs': 'var(--space-2xs)',
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)'
      },
      fontFamily: {
        sans: ['var(--font-family-sans)'],
        serif: ['var(--font-family-serif)'],
        mono: ['var(--font-family-mono)']
      },
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-md)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)'
      },
      fontWeight: {
        normal: 'var(--font-weight-regular)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)'
      },
      lineHeight: {
        tight: 'var(--line-height-tight)',
        normal: 'var(--line-height-normal)',
        relaxed: 'var(--line-height-relaxed)'
      }
    }
  }
} satisfies Config;

export default config;
