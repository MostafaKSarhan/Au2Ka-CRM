import { FastifyInstance } from 'fastify';
import { ZatcaController } from './zatca.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.RECEPTION];

export async function zatcaRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // The seller's own details and its ZATCA credentials are ADMIN only.
  fastify.get('/settings', { preHandler: [authorize([Role.ADMIN])] }, ZatcaController.getSettings);
  fastify.put('/settings', { preHandler: [authorize([Role.ADMIN])] }, ZatcaController.updateSettings);
  fastify.post('/onboard', { preHandler: [authorize([Role.ADMIN])] }, ZatcaController.onboard);
  fastify.get('/verify-chain', { preHandler: [authorize([Role.ADMIN])] }, ZatcaController.verifyChain);

  // Reception issues invoices as part of handing the vehicle back.
  fastify.get('/invoices', { preHandler: [authorize(STAFF)] }, ZatcaController.list);
  fastify.get('/invoices/:id', { preHandler: [authorize(STAFF)] }, ZatcaController.getOne);
  fastify.get('/invoices/:id/xml', { preHandler: [authorize(STAFF)] }, ZatcaController.downloadXml);
  fastify.post('/invoices', { preHandler: [authorize(STAFF)] }, ZatcaController.issue);
  fastify.post('/invoices/:id/submit', { preHandler: [authorize([Role.ADMIN])] }, ZatcaController.submit);
}
