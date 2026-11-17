import { FastifyInstance } from 'fastify';
import { AppointmentsController } from './appointments.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.RECEPTION];
const ALL_ROLES = [Role.ADMIN, Role.RECEPTION, Role.TECHNICIAN];

export async function appointmentsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Working hours and holidays shape the calendar — ADMIN sets them.
  fastify.get('/working-days', { preHandler: [authorize(ALL_ROLES)] }, AppointmentsController.listWorkingDays);
  fastify.put('/working-days/:weekday', { preHandler: [authorize([Role.ADMIN])] }, AppointmentsController.updateWorkingDay);
  fastify.get('/holidays', { preHandler: [authorize(ALL_ROLES)] }, AppointmentsController.listHolidays);
  fastify.post('/holidays', { preHandler: [authorize([Role.ADMIN])] }, AppointmentsController.createHoliday);
  fastify.delete('/holidays/:id', { preHandler: [authorize([Role.ADMIN])] }, AppointmentsController.removeHoliday);

  // The calendar itself
  fastify.get('/availability', { preHandler: [authorize(ALL_ROLES)] }, AppointmentsController.availability);
  fastify.get('/week', { preHandler: [authorize(ALL_ROLES)] }, AppointmentsController.week);
  fastify.get('/report', { preHandler: [authorize(STAFF)] }, AppointmentsController.report);

  fastify.get('/', { preHandler: [authorize(ALL_ROLES)] }, AppointmentsController.list);
  fastify.post('/', { preHandler: [authorize(STAFF)] }, AppointmentsController.book);
  fastify.put('/:id/status', { preHandler: [authorize(STAFF)] }, AppointmentsController.updateStatus);
  fastify.put('/:id/reschedule', { preHandler: [authorize(STAFF)] }, AppointmentsController.reschedule);
  fastify.post('/:id/convert', { preHandler: [authorize(STAFF)] }, AppointmentsController.convert);
  fastify.post('/reminders/run', { preHandler: [authorize([Role.ADMIN])] }, AppointmentsController.runReminders);
  fastify.delete('/:id', { preHandler: [authorize([Role.ADMIN])] }, AppointmentsController.remove);
}
