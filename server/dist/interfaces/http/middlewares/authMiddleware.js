"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AppError_1 = require("../../../shared/errors/AppError");
const errorCodes_1 = require("../../../shared/errors/errorCodes");
function authMiddleware(req, _res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return next(new AppError_1.AppError(errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Token requerido', 401));
    }
    const token = auth.slice(7);
    const secret = process.env.JWT_SECRET || 'sorteo-secret-cambiar-en-produccion';
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = decoded;
        return next();
    }
    catch {
        return next(new AppError_1.AppError(errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Token inválido', 401));
    }
}
