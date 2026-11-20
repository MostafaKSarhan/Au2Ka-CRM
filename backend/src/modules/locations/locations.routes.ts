import { FastifyInstance } from 'fastify';
import { LocationsController } from './locations.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const ALL_ROLES = [Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN];

export async function locationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Reference data is readable by everyone, editable by ADMIN only
  fastify.get('/countries', { preHandler: [authorize(ALL_ROLES)] }, LocationsController.listCountries);
  fastify.post('/countries', { preHandler: [authorize([Role.ADMIN])] }, LocationsController.createCountry);
  fastify.put('/countries/:id', { preHandler: [authorize([Role.ADMIN])] }, LocationsController.updateCountry);
  fastify.delete('/countries/:id', { preHandler: [authorize([Role.ADMIN])] }, LocationsController.removeCountry);

  fastify.get('/cities', { preHandler: [authorize(ALL_ROLES)] }, LocationsController.listCities);
  fastify.post('/cities', { preHandler: [authorize([Role.ADMIN])] }, LocationsController.createCity);
  fastify.put('/cities/:id', { preHandler: [authorize([Role.ADMIN])] }, LocationsController.updateCity);
  fastify.delete('/cities/:id', { preHandler: [authorize([Role.ADMIN])] }, LocationsController.removeCity);
}
