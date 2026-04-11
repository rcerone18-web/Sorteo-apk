"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
const errorCodes_1 = require("./errorCodes");
class AppError extends Error {
    code;
    status;
    details;
    constructor(code, message, status, details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
    }
    static internal(message = 'Error interno del servidor') {
        return new AppError(errorCodes_1.ERROR_CODES.INTERNAL_ERROR, message, 500);
    }
}
exports.AppError = AppError;
