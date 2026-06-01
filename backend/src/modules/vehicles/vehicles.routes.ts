import { FastifyInstance } from 'fastify';
import { VehiclesController } from './vehicles.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

export async function vehicleRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, VehiclesController.list);
  fastify.post('/', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN])] }, VehiclesController.create);
  fastify.put('/:id', { preHandler: [authorize([Role.ADMIN, Role.RECEPTION])] }, VehiclesController.update);
}
