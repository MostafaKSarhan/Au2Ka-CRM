import { FastifyInstance } from 'fastify';
import { VehicleCatalogController } from './vehicleCatalog.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const ALL_ROLES = [Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN];

export async function vehicleCatalogRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/brands', { preHandler: [authorize(ALL_ROLES)] }, VehicleCatalogController.listBrands);
  fastify.post('/brands', { preHandler: [authorize([Role.ADMIN])] }, VehicleCatalogController.createBrand);
  fastify.put('/brands/:id', { preHandler: [authorize([Role.ADMIN])] }, VehicleCatalogController.updateBrand);
  fastify.delete('/brands/:id', { preHandler: [authorize([Role.ADMIN])] }, VehicleCatalogController.removeBrand);

  fastify.get('/models', { preHandler: [authorize(ALL_ROLES)] }, VehicleCatalogController.listModels);
  fastify.post('/models', { preHandler: [authorize([Role.ADMIN])] }, VehicleCatalogController.createModel);
  fastify.put('/models/:id', { preHandler: [authorize([Role.ADMIN])] }, VehicleCatalogController.updateModel);
  fastify.delete('/models/:id', { preHandler: [authorize([Role.ADMIN])] }, VehicleCatalogController.removeModel);
}
