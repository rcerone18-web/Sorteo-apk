import { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2';
import { validateBody } from '../middlewares/validateBody';
import { loginSchema } from '../../../shared/validation/authSchemas';
import { pool } from '../../../infrastructure/database/mysqlClient';
import { AppError } from '../../../shared/errors/AppError';
import { ERROR_CODES } from '../../../shared/errors/errorCodes';

export const authRoutes = Router();

authRoutes.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { usuario, clave } = req.body as { usuario: string; clave: string };

    // Compatibilidad con el backend legacy: `users.password_hash` se compara directo con `clave`.
    type UserRow = RowDataPacket & {
      id: string;
      usuario: string;
      rol: 'asesor' | 'administrador';
      nombre: string | null;
    };
    const [rows] = await pool.execute<UserRow[]>(
      'SELECT id, usuario, rol, nombre FROM users WHERE usuario = ? AND password_hash = ?',
      [usuario, clave]
    );

    const row = rows?.[0];
    if (!row) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Credenciales incorrectas', 401);
    }

    const secret = process.env.JWT_SECRET || 'sorteo-secret-cambiar-en-produccion';
    const token = jwt.sign({ id: row.id, usuario: row.usuario, rol: row.rol }, secret, { expiresIn: '7d' });

    return res.json({
      token,
      usuario: { id: row.id, usuario: row.usuario, rol: row.rol, nombre: row.nombre ?? undefined },
    });
  } catch (err) {
    return next(err);
  }
});

