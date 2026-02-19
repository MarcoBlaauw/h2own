import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
import '../src/vitest.setup.ts';

import { setProjectAnnotations } from '@storybook/sveltekit';
import * as preview from './preview';

setProjectAnnotations([a11yAddonAnnotations, preview]);
