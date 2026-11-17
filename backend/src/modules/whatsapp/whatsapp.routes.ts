import { FastifyInstance } from 'fastify';
import { WhatsAppController } from './whatsapp.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

/** Staff-facing settings — mounted under /api/v1/whatsapp. */
export async function whatsappRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // The connection is the workshop owner's to configure.
  fastify.get('/settings', { preHandler: [authorize([Role.ADMIN])] }, WhatsAppController.getSettings);
  fastify.put('/settings', { preHandler: [authorize([Role.ADMIN])] }, WhatsAppController.updateSettings);
  fastify.post('/verify', { preHandler: [authorize([Role.ADMIN])] }, WhatsAppController.verify);
  fastify.put('/templates/:id/meta', { preHandler: [authorize([Role.ADMIN])] }, WhatsAppController.linkTemplate);
}

/**
 * Meta's webhook — mounted under /api/v1/webhooks and deliberately open.
 * It is guarded by the verify token rather than by a login, because Meta
 * cannot carry one.
 */
export async function whatsappWebhookRoutes(fastify: FastifyInstance) {
  fastify.get('/whatsapp', WhatsAppController.verifyWebhook);
  fastify.post('/whatsapp', WhatsAppController.receiveWebhook);
}
