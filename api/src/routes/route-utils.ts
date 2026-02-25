import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  PoolForbiddenError,
  PoolNotFoundError,
  PoolOwnerRequiredError,
  PoolCreateOwnerForbiddenError,
  PoolLocationAccessError,
  PoolValidationError,
} from '../services/pools/index.js';

export function handleZodError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) {
    reply.code(400).send({ error: 'ValidationError', details: error.errors });
    return true;
  }

  return false;
}

export function handlePoolLocationAccessError(reply: FastifyReply, error: unknown) {
  if (error instanceof PoolLocationAccessError) {
    reply
      .code(400)
      .send({ error: 'InvalidLocation', locationId: error.locationId, message: error.message });
    return true;
  }

  return false;
}

export function handlePoolAccessError(reply: FastifyReply, error: unknown) {
  if (error instanceof PoolNotFoundError) {
    reply.code(404).send({ error: 'Pool not found' });
    return true;
  }

  if (
    error instanceof PoolForbiddenError ||
    error instanceof PoolOwnerRequiredError ||
    error instanceof PoolCreateOwnerForbiddenError
  ) {
    reply.code(403).send({ error: 'Forbidden' });
    return true;
  }

  return false;
}

export function handlePoolValidationError(reply: FastifyReply, error: unknown) {
  if (error instanceof PoolValidationError) {
    reply.code(400).send({ error: 'ValidationError', details: [{ message: error.message }] });
    return true;
  }

  return false;
}

type RouteHandler = (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

type WrapPoolRouteOptions = {
  onError?: (error: unknown, req: FastifyRequest, reply: FastifyReply) => Promise<boolean> | boolean;
};

export function wrapPoolRoute(handler: RouteHandler, options: WrapPoolRouteOptions = {}) {
  return async function wrappedRoute(req: FastifyRequest, reply: FastifyReply) {
    try {
      return await handler(req, reply);
    } catch (error) {
      if (handleZodError(reply, error)) {
        return;
      }

      if (options.onError && (await options.onError(error, req, reply))) {
        return;
      }

      if (handlePoolLocationAccessError(reply, error)) {
        return;
      }

      if (handlePoolValidationError(reply, error)) {
        return;
      }

      if (handlePoolAccessError(reply, error)) {
        return;
      }

      throw error;
    }
  };
}
