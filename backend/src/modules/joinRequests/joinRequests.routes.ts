import { FastifyInstance } from 'fastify';
import { JoinRequestsController } from './joinRequests.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const STAFF: Role[] = ['ADMIN', 'RECEPTION'];

/**
 * الإرسال عام بلا تسجيل دخول — صاحبه ليس عميلًا بعد — والمراجعة للموظفين.
 * الفصل مقصود: لا يصير أحد عميلًا إلا باعتماد الورشة.
 */
export async function publicJoinRoutes(fastify: FastifyInstance) {
  fastify.post('/join-request', JoinRequestsController.submit);
}

export async function joinRequestsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { preHandler: [authorize(STAFF)] }, JoinRequestsController.list);
  fastify.post('/:id/approve', { preHandler: [authorize(STAFF)] }, JoinRequestsController.approve);
  fastify.post('/:id/reject', { preHandler: [authorize(STAFF)] }, JoinRequestsController.reject);
}
