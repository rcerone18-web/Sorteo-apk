"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const validateBody_1 = require("../middlewares/validateBody");
const authSchemas_1 = require("../../../shared/validation/authSchemas");
const mysqlClient_1 = require("../../../infrastructure/database/mysqlClient");
const AppError_1 = require("../../../shared/errors/AppError");
const errorCodes_1 = require("../../../shared/errors/errorCodes");
exports.authRoutes = (0, express_1.Router)();
exports.authRoutes.post('/login', (0, validateBody_1.validateBody)(authSchemas_1.loginSchema), async (req, res, next) => {
    try {
        const { usuario, clave } = req.body;
        const [rows] = await mysqlClient_1.pool.execute('SELECT id, usuario, rol, nombre FROM users WHERE usuario = ? AND password_hash = ?', [usuario, clave]);
        const row = rows?.[0];
        if (!row) {
            throw new AppError_1.AppError(errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Credenciales incorrectas', 401);
        }
        const secret = process.env.JWT_SECRET || 'sorteo-secret-cambiar-en-produccion';
        const token = jsonwebtoken_1.default.sign({ id: row.id, usuario: row.usuario, rol: row.rol }, secret, { expiresIn: '7d' });
        return res.json({
            token,
            usuario: { id: row.id, usuario: row.usuario, rol: row.rol, nombre: row.nombre ?? undefined },
        });
    }
    catch (err) {
        return next(err);
    }
});
