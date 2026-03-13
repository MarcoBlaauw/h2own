import { z } from 'zod';

const optionalPoolNumber = () =>
  z.preprocess(
    (value) => {
      if (value === '' || value === undefined) {
        return undefined;
      }
      if (value === null) {
        return null;
      }
      return value;
    },
    z.union([z.coerce.number(), z.null()]).optional()
  );

export const parseCreateLocationId = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  },
  z.string().uuid().optional()
);

export const parseUpdateLocationId = z.preprocess(
  (value) => {
    if (value === '' || value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    return value;
  },
  z.union([z.string().uuid(), z.null()]).optional()
);

export const optionalPoolFields = {
  chlorineSource: z.preprocess(
    (value) => {
      if (value === '' || value === undefined) {
        return undefined;
      }
      if (value === null) {
        return null;
      }
      return value;
    },
    z.union([z.string(), z.null()]).optional()
  ),
  saltLevelPpm: optionalPoolNumber().refine(
    (value) => value === undefined || value === null || (value > 0 && value <= 6000),
    'Salt target ppm must be greater than 0 and no more than 6000.'
  ),
  sanitizerTargetMinPpm: optionalPoolNumber().refine(
    (value) => value === undefined || value === null || (value > 0 && value <= 20),
    'Sanitizer target min ppm must be greater than 0 and no more than 20. Enter sanitizer residual ppm, not salt ppm.'
  ),
  sanitizerTargetMaxPpm: optionalPoolNumber().refine(
    (value) => value === undefined || value === null || (value > 0 && value <= 20),
    'Sanitizer target max ppm must be greater than 0 and no more than 20. Enter sanitizer residual ppm, not salt ppm.'
  ),
  shadeLevel: z.string().optional(),
  enclosureType: z.string().optional(),
  hasCover: z.coerce.boolean().optional(),
  pumpGpm: z.coerce.number().optional(),
  filterType: z.string().optional(),
  hasHeater: z.coerce.boolean().optional(),
} as const;
