import { FastifyInstance } from 'fastify';
import { UsersController } from './users.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // ADMIN only: full management
  fastify.get('/', { preHandler: [authorize([Role.ADMIN])] }, UsersController.list);
  fastify.post('/', { preHandler: [authorize([Role.ADMIN])] }, UsersController.create);
  fastify.put('/:id', { preHandler: [authorize([Role.ADMIN])] }, UsersController.update);
  fastify.delete('/:id', { preHandler: [authorize([Role.ADMIN])] }, UsersController.remove);

  // ADMIN + RECEPTION + TECHNICIAN: get technicians list for job card auto-fill
  fastify.get('/technicians', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, UsersController.listTechnicians);
}
