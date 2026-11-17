import { FastifyInstance } from 'fastify';
import { InventoryController } from './inventory.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.RECEPTION];
const ALL_ROLES = [Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN];

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/report', { preHandler: [authorize(STAFF)] }, InventoryController.report);
  fastify.get('/low-stock', { preHandler: [authorize(ALL_ROLES)] }, InventoryController.lowStock);
  fastify.get('/movements', { preHandler: [authorize(ALL_ROLES)] }, InventoryController.movements);

  // Receiving goods and correcting a count are warehouse decisions.
  fastify.post('/intake', { preHandler: [authorize(STAFF)] }, InventoryController.intake);
  fastify.post('/stock-count', { preHandler: [authorize([Role.ADMIN])] }, InventoryController.stockCount);

  // The technician issues parts as part of doing the repair.
  fastify.post('/issue', { preHandler: [authorize(ALL_ROLES)] }, InventoryController.issue);
}
