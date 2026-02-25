import { z } from 'zod';

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
  saltLevelPpm: z.preprocess(
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
  ),
  sanitizerTargetMinPpm: z.preprocess(
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
  ),
  sanitizerTargetMaxPpm: z.preprocess(
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
  ),
  shadeLevel: z.string().optional(),
  enclosureType: z.string().optional(),
  hasCover: z.coerce.boolean().optional(),
  pumpGpm: z.coerce.number().optional(),
  filterType: z.string().optional(),
  hasHeater: z.coerce.boolean().optional(),
} as const;
