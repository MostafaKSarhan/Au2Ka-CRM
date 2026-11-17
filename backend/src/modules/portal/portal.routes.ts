import { FastifyInstance } from 'fastify';
import { PortalController } from './portal.controller';
import { authenticatePortal } from './portal.auth';

/**
 * M7 — the customer portal, mounted under /api/v1/portal.
 *
 * These routes never use the staff middleware: a portal token must not reach
 * a staff endpoint, and a staff token must not reach the portal.
 */
export async function portalRoutes(fastify: FastifyInstance) {
  // Open: asking for and using a one-time code.
  fastify.post('/auth/request-otp', PortalController.requestOtp);
  fastify.post('/auth/verify-otp', PortalController.verifyOtp);
  fastify.post('/auth/logout', PortalController.logout);

  // Everything below belongs to the signed-in customer alone.
  fastify.register(async secured => {
    secured.addHook('preHandler', authenticatePortal);

    secured.get('/me', PortalController.me);
    secured.get('/job-cards', PortalController.jobCards);
    secured.get('/vehicles/:vehicleId/file', PortalController.vehicleFile);
    secured.get('/reports', PortalController.reports);
    secured.get('/reports/:reportId', PortalController.report);

    secured.get('/availability', PortalController.availability);
    secured.get('/appointments', PortalController.appointments);
    secured.post('/appointments', PortalController.book);
    secured.post('/appointments/:appointmentId/cancel', PortalController.cancelAppointment);
  });
}
