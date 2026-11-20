import { FastifyInstance } from 'fastify';
import { InspectionsController } from './inspections.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const ALL_ROLES = [Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN];
const STAFF = [Role.ADMIN, Role.RECEPTION];

export async function inspectionsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // The approved checklist — ADMIN defines it, everyone reads it.
  fastify.get('/items', { preHandler: [authorize(ALL_ROLES)] }, InspectionsController.listItems);
  fastify.post('/items', { preHandler: [authorize([Role.ADMIN])] }, InspectionsController.createItem);
  fastify.put('/items/:id', { preHandler: [authorize([Role.ADMIN])] }, InspectionsController.updateItem);
  fastify.delete('/items/:id', { preHandler: [authorize([Role.ADMIN])] }, InspectionsController.removeItem);

  // The form itself — filling it in is the technician's job.
  fastify.get('/job-card/:jobCardId', { preHandler: [authorize(ALL_ROLES)] }, InspectionsController.getForJobCard);
  fastify.put('/job-card/:jobCardId', { preHandler: [authorize(ALL_ROLES)] }, InspectionsController.save);
  fastify.get('/vehicle/:vehicleId/history', { preHandler: [authorize(ALL_ROLES)] }, InspectionsController.history);
}

/** Monthly reports — mounted under /api/v1/monthly-reports. */
export async function monthlyReportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { preHandler: [authorize(STAFF)] }, InspectionsController.listReports);
  fastify.get('/:id', { preHandler: [authorize(STAFF)] }, InspectionsController.getReport);
  fastify.post('/generate', { preHandler: [authorize(STAFF)] }, InspectionsController.generate);
  fastify.post('/:id/sent', { preHandler: [authorize(STAFF)] }, InspectionsController.markReportSent);
}
