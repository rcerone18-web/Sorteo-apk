"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = errorMiddleware;
const zod_1 = require("zod");
const AppError_1 = require("../../../shared/errors/AppError");
const errorCodes_1 = require("../../../shared/errors/errorCodes");
const logger_1 = require("../../../shared/logging/logger");
function errorMiddleware(err, _req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            error: {
                code: errorCodes_1.ERROR_CODES.VALIDATION_ERROR,
                message: 'Datos inválidos',
                details: err.flatten(),
            },
        });
    }
    if (err instanceof AppError_1.AppError) {
        return res.status(err.status).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        });
    }
    logger_1.logger.error({ err }, 'Unhandled error');
    return res.status(500).json({
        error: {
            code: errorCodes_1.ERROR_CODES.INTERNAL_ERROR,
            message: 'Error interno del servidor',
        },
    });
}
