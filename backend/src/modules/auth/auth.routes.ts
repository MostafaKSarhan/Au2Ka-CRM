import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/auth';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', AuthController.login);
  fastify.post('/logout', { preHandler: [authenticate] }, AuthController.logout);
  fastify.get('/me', { preHandler: [authenticate] }, AuthController.me);
}
