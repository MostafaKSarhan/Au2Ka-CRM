import { FastifyInstance } from 'fastify';
import { CustomersController } from './customers.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

export async function customerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, CustomersController.list);
  fastify.get('/:id', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, CustomersController.get);
  fastify.post('/', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, CustomersController.create);
  fastify.put('/:id', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION])] }, CustomersController.update);
  fastify.delete('/:id', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION])] }, CustomersController.delete);
}
