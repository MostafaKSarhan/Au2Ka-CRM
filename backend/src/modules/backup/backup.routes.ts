import { FastifyInstance } from 'fastify';
import { BackupController } from './backup.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

export async function backupRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // A full database dump is ADMIN only.
  fastify.get('/info', { preHandler: [authorize([Role.ADMIN])] }, BackupController.info);
  fastify.get('/download', { preHandler: [authorize([Role.ADMIN])] }, BackupController.download);
}
