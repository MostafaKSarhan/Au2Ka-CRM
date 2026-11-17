import { FastifyInstance } from 'fastify';
import { PlansController } from './plans.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.RECEPTION];

export async function plansRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Reception needs to read plans in order to sell a subscription;
  // defining and pricing them stays with ADMIN.
  fastify.get('/', { preHandler: [authorize(STAFF)] }, PlansController.list);
  fastify.get('/:id', { preHandler: [authorize(STAFF)] }, PlansController.getOne);
  fastify.post('/', { preHandler: [authorize([Role.ADMIN])] }, PlansController.create);
  fastify.put('/:id', { preHandler: [authorize([Role.ADMIN])] }, PlansController.update);
  fastify.delete('/:id', { preHandler: [authorize([Role.ADMIN])] }, PlansController.remove);
}
