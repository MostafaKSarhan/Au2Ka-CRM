import { FastifyInstance } from 'fastify';
import { MessagingController } from './messaging.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.RECEPTION];
const ALL_ROLES = [Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN];

export async function messagingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Templates — ADMIN writes the wording, reception reads it.
  fastify.get('/templates', { preHandler: [authorize(STAFF)] }, MessagingController.listTemplates);
  fastify.post('/templates', { preHandler: [authorize([Role.ADMIN])] }, MessagingController.createTemplate);
  fastify.put('/templates/:id', { preHandler: [authorize([Role.ADMIN])] }, MessagingController.updateTemplate);
  fastify.delete('/templates/:id', { preHandler: [authorize([Role.ADMIN])] }, MessagingController.removeTemplate);
  fastify.post('/templates/:id/preview', { preHandler: [authorize(STAFF)] }, MessagingController.previewTemplate);

  // Queue and log
  fastify.get('/messages', { preHandler: [authorize(STAFF)] }, MessagingController.listMessages);
  fastify.get('/messages/stats', { preHandler: [authorize(STAFF)] }, MessagingController.stats);
  fastify.post('/messages', { preHandler: [authorize(STAFF)] }, MessagingController.queue);
  fastify.post('/messages/run', { preHandler: [authorize([Role.ADMIN])] }, MessagingController.runQueue);
  fastify.post('/messages/:id/sent', { preHandler: [authorize(STAFF)] }, MessagingController.markSent);
  fastify.post('/messages/:id/retry', { preHandler: [authorize(STAFF)] }, MessagingController.retry);
  fastify.post('/messages/:id/cancel', { preHandler: [authorize(STAFF)] }, MessagingController.cancel);

  // Opt-out
  fastify.put('/opt-out/:customerId', { preHandler: [authorize(STAFF)] }, MessagingController.setOptOut);

  // In-system notifications — every role has its own inbox.
  fastify.get('/notifications', { preHandler: [authorize(ALL_ROLES)] }, MessagingController.listNotifications);
  fastify.post('/notifications/:id/read', { preHandler: [authorize(ALL_ROLES)] }, MessagingController.markNotificationRead);
  fastify.post('/notifications/read-all', { preHandler: [authorize(ALL_ROLES)] }, MessagingController.markAllRead);
}
