import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  chemicalsService,
  DuplicateChemicalError,
  InvalidChemicalTypeForCategoryError,
} from '../services/chemicals.js';
import { CHEMICAL_FORMS, CATALOG_PRODUCT_TYPES, PRODUCT_ITEM_CLASSES } from '../services/chemical-catalog.js';

const getChemicalsQuery = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
});

const numericInput = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .min(1)
      .refine((val) => !Number.isNaN(Number(val)), { message: 'Invalid number' }),
  ])
  .transform((val) => (typeof val === 'number' ? val : Number(val)));

const optionalNumber = numericInput.optional();
const optionalInteger = numericInput.pipe(z.number().int()).optional();
const vendorPriceBody = z.object({
  vendorId: z.string().uuid(),
  vendorSku: z.string().max(120).optional(),
  productUrl: z.string().url().optional(),
  unitPrice: numericInput.pipe(z.number().positive()),
  currency: z.string().trim().length(3).optional(),
  packageSize: z.string().max(80).optional(),
  unitLabel: z.string().max(30).optional(),
  source: z.enum(['manual', 'external']).optional(),
  fetchedAt: z.string().datetime().optional(),
  isPrimary: z.boolean().optional(),
});

const createChemicalBody = z.object({
  categoryId: z.string().uuid(),
  itemClass: z.enum(PRODUCT_ITEM_CLASSES).optional(),
  name: z.string().min(1).max(120),
  brand: z.string().max(80).optional(),
  sku: z.string().max(80).optional(),
  productType: z.enum(CATALOG_PRODUCT_TYPES).optional(),
  activeIngredients: z.record(numericInput).optional(),
  concentrationPercent: optionalNumber,
  phEffect: optionalNumber,
  strengthFactor: optionalNumber,
  dosePer10kGallons: optionalNumber,
  doseUnit: z.string().max(20).optional(),
  affectsFc: z.boolean().optional(),
  affectsPh: z.boolean().optional(),
  affectsTa: z.boolean().optional(),
  affectsCya: z.boolean().optional(),
  fcChangePerDose: optionalNumber,
  phChangePerDose: optionalNumber,
  taChangePerDose: optionalInteger,
  cyaChangePerDose: optionalInteger,
  form: z.enum(CHEMICAL_FORMS).optional(),
  packageSizes: z.array(z.string().min(1)).optional(),
  replacementIntervalDays: optionalInteger,
  compatibleEquipmentType: z.string().max(80).optional(),
  notes: z.string().max(4000).optional(),
  isActive: z.boolean().optional(),
  averageCostPerUnit: optionalNumber,
  vendorPrices: z.array(vendorPriceBody).optional(),
});

const updateChemicalBody = createChemicalBody.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: 'At least one property must be provided.' }
);

const chemicalIdParam = z.object({
  id: z.string().uuid(),
});

export async function chemicalsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    try {
      const { q, category } = getChemicalsQuery.parse(req.query);
      const chemicals = await chemicalsService.getChemicals(q, category);
      return reply.send(chemicals);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      throw err;
    }
  });

  app.post(
    '/',
    {
      preHandler: [app.auth.verifySession, app.auth.requireRole('admin')],
    },
    async (req, reply) => {
      try {
        const body = createChemicalBody.parse(req.body);
        const chemical = await chemicalsService.createChemical(body);
        return reply.code(201).send(chemical);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'ValidationError', details: err.errors });
        }
        if (err instanceof DuplicateChemicalError) {
          return reply.code(409).send({ error: 'DuplicateChemical', existingChemicalId: err.existingChemicalId });
        }
        if (err instanceof InvalidChemicalTypeForCategoryError) {
          return reply.code(400).send({
            error: 'ValidationError',
            details: [
              {
                message: `Product type "${err.productType}" is not allowed for category "${err.categoryName}".`,
                path: ['productType'],
              },
            ],
          });
        }
        throw err;
      }
    }
  );

  app.patch(
    '/:id',
    {
      preHandler: [app.auth.verifySession, app.auth.requireRole('admin')],
    },
    async (req, reply) => {
      try {
        const { id } = chemicalIdParam.parse(req.params);
        const body = updateChemicalBody.parse(req.body ?? {});

        const chemical = await chemicalsService.updateChemical(id, body);
        if (!chemical) {
          return reply.code(404).send({ error: 'NotFound' });
        }

        return reply.send(chemical);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'ValidationError', details: err.errors });
        }
        if (err instanceof DuplicateChemicalError) {
          return reply.code(409).send({ error: 'DuplicateChemical', existingChemicalId: err.existingChemicalId });
        }
        if (err instanceof InvalidChemicalTypeForCategoryError) {
          return reply.code(400).send({
            error: 'ValidationError',
            details: [
              {
                message: `Product type "${err.productType}" is not allowed for category "${err.categoryName}".`,
                path: ['productType'],
              },
            ],
          });
        }
        throw err;
      }
    }
  );

  app.delete(
    '/:id',
    {
      preHandler: [app.auth.verifySession, app.auth.requireRole('admin')],
    },
    async (req, reply) => {
      try {
        const { id } = chemicalIdParam.parse(req.params);
        const deleted = await chemicalsService.deleteChemical(id);

        if (!deleted) {
          return reply.code(404).send({ error: 'NotFound' });
        }

        return reply.code(204).send();
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'ValidationError', details: err.errors });
        }
        throw err;
      }
    }
  );

  app.get(
    '/categories',
    {
      preHandler: [app.auth.verifySession, app.auth.requireRole('admin')],
    },
    async (_req, reply) => {
      const categories = await chemicalsService.listCategories();
      return reply.send(categories);
    }
  );
}
