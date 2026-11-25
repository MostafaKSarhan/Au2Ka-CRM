import { FastifyInstance } from 'fastify';
import { SubscriptionsController } from './subscriptions.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.RECEPTION];
const ALL_ROLES = [Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN];

export async function subscriptionsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/stats', { preHandler: [authorize(STAFF)] }, SubscriptionsController.stats);

  // The technician sees the "subscriber" badge on a job card, so reading
  // the active coverage is open to every role.
  fastify.get(
    '/customer/:customerId/active',
    { preHandler: [authorize(ALL_ROLES)] },
    SubscriptionsController.activeForCustomer,
  );

  fastify.get('/', { preHandler: [authorize(STAFF)] }, SubscriptionsController.list);
  fastify.get('/:id', { preHandler: [authorize(STAFF)] }, SubscriptionsController.getOne);
  fastify.post('/', { preHandler: [authorize(STAFF)] }, SubscriptionsController.create);
  fastify.post('/:id/renew', { preHandler: [authorize(STAFF)] }, SubscriptionsController.renew);
  fastify.put('/:id', { preHandler: [authorize(STAFF)] }, SubscriptionsController.update);
  fastify.delete('/:id', { preHandler: [authorize([Role.ADMIN])] }, SubscriptionsController.remove);
}
