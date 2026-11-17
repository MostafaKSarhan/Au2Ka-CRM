import { FastifyInstance } from 'fastify';
import { BranchesController } from './branches.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const ALL_ROLES = [Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN];

export async function branchesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { preHandler: [authorize(ALL_ROLES)] }, BranchesController.list);
  fastify.get('/:id', { preHandler: [authorize(ALL_ROLES)] }, BranchesController.getOne);
  fastify.post('/', { preHandler: [authorize([Role.ADMIN])] }, BranchesController.create);
  fastify.put('/:id', { preHandler: [authorize([Role.ADMIN])] }, BranchesController.update);
  fastify.delete('/:id', { preHandler: [authorize([Role.ADMIN])] }, BranchesController.remove);
}
