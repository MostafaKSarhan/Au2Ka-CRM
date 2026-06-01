import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';
import {
  getDashboardStats,
  getRecentJobCards,
  getJobCardsReport,
  getCustomersReport,
  getVehiclesReport,
  getGlobalSearch
} from './reports.controller';

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/dashboard/stats', getDashboardStats);
  app.get('/dashboard/recent-job-cards', getRecentJobCards);
  app.get('/reports/job-cards', getJobCardsReport);
  app.get('/reports/customers', getCustomersReport);
  app.get('/reports/vehicles', getVehiclesReport);
  app.get('/search', getGlobalSearch);
}
