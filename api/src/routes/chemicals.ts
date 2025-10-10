import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { chemicalsService } from '../services/chemicals.js';

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

const createChemicalBody = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120),
  brand: z.string().max(80).optional(),
  productType: z.string().max(50).optional(),
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
  form: z.string().max(20).optional(),
  packageSizes: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional(),
  averageCostPerUnit: optionalNumber,
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
        throw err;
      }
    }
  );
}
