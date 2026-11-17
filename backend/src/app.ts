import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import path from 'path';
import fs from 'fs';
import { AppError } from './utils/appError';
import { authRoutes } from './modules/auth/auth.routes';
import { customerRoutes } from './modules/customers/customers.routes';
import { vehicleRoutes } from './modules/vehicles/vehicles.routes';
import { jobCardRoutes } from './modules/jobCards/jobCards.routes';
import { reportsRoutes } from './modules/reports/reports.routes';
import { usersRoutes } from './modules/users/users.routes';
import { locationsRoutes } from './modules/locations/locations.routes';
import { branchesRoutes } from './modules/branches/branches.routes';
import { vehicleCatalogRoutes } from './modules/vehicleCatalog/vehicleCatalog.routes';
import { partsRoutes } from './modules/parts/parts.routes';
import { backupRoutes } from './modules/backup/backup.routes';
import { plansRoutes } from './modules/plans/plans.routes';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes';
import { vehicleFileRoutes, publicVehicleFileRoutes } from './modules/vehicleFile/vehicleFile.routes';
import { messagingRoutes } from './modules/messaging/messaging.routes';
import { inspectionsRoutes, monthlyReportsRoutes } from './modules/inspections/inspections.routes';
import { appointmentsRoutes } from './modules/appointments/appointments.routes';

const app: FastifyInstance = fastify({ logger: true });

// Setup Uploads folder locally
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Register Swagger
app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Workshop CRM API',
      description: 'API documentation for Workshop CRM (MVP)',
      version: '1.0.0'
    }
  }
});

app.register(fastifySwaggerUi, {
  routePrefix: '/api/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  }
});

// Register plugins
app.register(cors, {
  origin: true,
  credentials: true,
});
app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});
app.register(fastifyStatic, {
  root: uploadDir,
  prefix: '/uploads/',
});

// Health check
app.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date() };
});

// Register Module routes
app.register(authRoutes, { prefix: '/api/v1/auth' });
app.register(customerRoutes, { prefix: '/api/v1/customers' });
app.register(vehicleRoutes, { prefix: '/api/v1/vehicles' });
app.register(jobCardRoutes, { prefix: '/api/v1/job-cards' });
app.register(reportsRoutes, { prefix: '/api/v1' });
app.register(usersRoutes, { prefix: '/api/v1/users' });

// Phase 2 — R0: reference data & control panel
app.register(locationsRoutes, { prefix: '/api/v1/locations' });
app.register(branchesRoutes, { prefix: '/api/v1/branches' });
app.register(vehicleCatalogRoutes, { prefix: '/api/v1/vehicle-catalog' });
app.register(partsRoutes, { prefix: '/api/v1/parts' });
app.register(backupRoutes, { prefix: '/api/v1/backup' });

// Phase 2 — M1: subscriptions & annual plans
app.register(plansRoutes, { prefix: '/api/v1/plans' });
app.register(subscriptionsRoutes, { prefix: '/api/v1/subscriptions' });

// Phase 2 — M3: vehicle lifetime file (plus the customer's public share link)
app.register(vehicleFileRoutes, { prefix: '/api/v1/vehicle-file' });
app.register(publicVehicleFileRoutes, { prefix: '/api/v1/public' });

// Phase 2 — M6: messaging, templates and in-system alerts
app.register(messagingRoutes, { prefix: '/api/v1/messaging' });

// Phase 2 — M2: technical inspection checklist and monthly vehicle reports
app.register(inspectionsRoutes, { prefix: '/api/v1/inspections' });
app.register(monthlyReportsRoutes, { prefix: '/api/v1/monthly-reports' });

// Phase 2 — M4: appointments, working hours and subscriber priority
app.register(appointmentsRoutes, { prefix: '/api/v1/appointments' });

// Global Error Handler
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      status: 'error',
      message: error.message,
    });
  }

  // Handle default validation errors or database connection issues
  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      status: 'error',
      message: error.message,
    });
  }

  return reply.status(500).send({
    status: 'error',
    message: 'Internal server error occurred',
  });
});

export default app;
