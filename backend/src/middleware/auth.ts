import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AppError } from '../utils/appError';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      mobileNumber: string;
      role: Role;
    };
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-workshop-crm-2026';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token missing or invalid', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      mobileNumber: string;
      role: Role;
    };

    request.user = decoded;
  } catch (error: any) {
    throw new AppError(error.message || 'Authentication failed', 401);
  }
}

export function authorize(roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new AppError('Unauthorized access', 401);
    }

    if (!roles.includes(request.user.role)) {
      throw new AppError('Access denied: Insufficient permissions', 403);
    }
  };
}
