import { FastifyInstance } from 'fastify';
import { PartsController } from './parts.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN];

export async function partsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Reading the catalog is needed on the job card; editing it is ADMIN only.
  fastify.get('/', { preHandler: [authorize(STAFF)] }, PartsController.list);
  fastify.get('/categories', { preHandler: [authorize(STAFF)] }, PartsController.categories);
  fastify.get('/:id', { preHandler: [authorize(STAFF)] }, PartsController.getOne);
  fastify.post('/', { preHandler: [authorize([Role.ADMIN])] }, PartsController.create);
  fastify.put('/:id', { preHandler: [authorize([Role.ADMIN])] }, PartsController.update);
  fastify.delete('/:id', { preHandler: [authorize([Role.ADMIN])] }, PartsController.remove);
}
