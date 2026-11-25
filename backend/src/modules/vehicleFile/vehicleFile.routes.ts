import { FastifyInstance } from 'fastify';
import { VehicleFileController } from './vehicleFile.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const ALL_ROLES = [Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN];
const STAFF = [Role.ADMIN, Role.RECEPTION];

/** Staff-facing vehicle file — mounted under /api/v1/vehicle-file. */
export async function vehicleFileRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get(
    '/documents/expiring',
    { preHandler: [authorize(STAFF)] },
    VehicleFileController.expiringDocuments,
  );

  fastify.get('/:id', { preHandler: [authorize(ALL_ROLES)] }, VehicleFileController.getFile);

  // Share link
  fastify.post('/:id/share', { preHandler: [authorize(STAFF)] }, VehicleFileController.createShareLink);
  fastify.delete('/:id/share', { preHandler: [authorize(STAFF)] }, VehicleFileController.revokeShareLink);

  // Documents
  fastify.get('/:id/documents', { preHandler: [authorize(ALL_ROLES)] }, VehicleFileController.listDocuments);
  fastify.post('/:id/documents', { preHandler: [authorize(STAFF)] }, VehicleFileController.createDocument);
  fastify.put('/documents/:documentId', { preHandler: [authorize(STAFF)] }, VehicleFileController.updateDocument);
  fastify.delete('/documents/:documentId', { preHandler: [authorize(STAFF)] }, VehicleFileController.removeDocument);

  // Replaced parts — the technician records these as part of the repair.
  fastify.post('/:id/parts', { preHandler: [authorize(ALL_ROLES)] }, VehicleFileController.createReplacement);
  fastify.put('/parts/:replacementId', { preHandler: [authorize(ALL_ROLES)] }, VehicleFileController.updateReplacement);
  fastify.delete('/parts/:replacementId', { preHandler: [authorize(STAFF)] }, VehicleFileController.removeReplacement);

  // Mileage
  fastify.post('/:id/mileage', { preHandler: [authorize(ALL_ROLES)] }, VehicleFileController.addMileage);
}

/** The customer's read-only link — no authentication, mounted under /api/v1/public. */
export async function publicVehicleFileRoutes(fastify: FastifyInstance) {
  fastify.get('/vehicle-file/:token', VehicleFileController.getPublicFile);
}
