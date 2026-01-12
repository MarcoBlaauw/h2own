import '../src/vitest.setup.ts';

import { setProjectAnnotations } from '@storybook/svelte';
import * as preview from './preview';

setProjectAnnotations(preview);
