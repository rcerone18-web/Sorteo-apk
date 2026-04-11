import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../../../shared/errors/AppError';
import { ERROR_CODES } from '../../../shared/errors/errorCodes';

declare global {
  // eslint-disable-next-line no-var
  var __authUser: unknown;
}

export interface AuthUser {
  id: string;
  usuario: string;
  rol: 'asesor' | 'administrador';
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return next(new AppError(ERROR_CODES.UNAUTHORIZED, 'Token requerido', 401));
  }
  const token = auth.slice(7);
  const secret = process.env.JWT_SECRET || 'sorteo-secret-cambiar-en-produccion';
  try {
    const decoded = jwt.verify(token, secret) as AuthUser;
    req.user = decoded;
    return next();
  } catch {
    return next(new AppError(ERROR_CODES.UNAUTHORIZED, 'Token inválido', 401));
  }
}

