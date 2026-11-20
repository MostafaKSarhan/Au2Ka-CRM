import { FastifyInstance } from 'fastify';
import { ReferralsController } from './referrals.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.RECEPTION];

export async function referralsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // The reward rule itself is the workshop owner's call.
  fastify.get('/settings', { preHandler: [authorize(STAFF)] }, ReferralsController.getSettings);
  fastify.put('/settings', { preHandler: [authorize([Role.ADMIN])] }, ReferralsController.updateSettings);

  fastify.get('/report', { preHandler: [authorize(STAFF)] }, ReferralsController.report);
  fastify.get('/', { preHandler: [authorize(STAFF)] }, ReferralsController.listReferrals);
  fastify.post('/link', { preHandler: [authorize(STAFF)] }, ReferralsController.link);

  fastify.get('/customer/:customerId/code', { preHandler: [authorize(STAFF)] }, ReferralsController.getCode);
  fastify.get('/customer/:customerId/wallet', { preHandler: [authorize(STAFF)] }, ReferralsController.wallet);
  fastify.post('/customer/:customerId/redeem', { preHandler: [authorize(STAFF)] }, ReferralsController.redeem);
  fastify.post('/customer/:customerId/tier', { preHandler: [authorize(STAFF)] }, ReferralsController.recalculateTier);
  // Hand-editing a balance stays with ADMIN, and always carries a reason.
  fastify.post('/customer/:customerId/adjust', { preHandler: [authorize([Role.ADMIN])] }, ReferralsController.adjust);
}
