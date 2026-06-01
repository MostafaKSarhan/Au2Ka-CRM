import { FastifyInstance } from 'fastify';
import { JobCardsController } from './jobCards.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

export async function jobCardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, JobCardsController.list);
  fastify.get('/:id', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, JobCardsController.get);
  fastify.post('/', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, JobCardsController.create);
  fastify.put('/:id', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, JobCardsController.update);
  fastify.post('/:id/photos', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, JobCardsController.uploadPhoto);
  fastify.delete('/:id', { preHandler: [authorize([Role.ADMIN])] }, JobCardsController.delete);
}
