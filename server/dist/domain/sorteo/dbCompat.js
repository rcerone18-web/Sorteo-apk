"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSchemaMismatchError = isSchemaMismatchError;
/** Errores MySQL típicos cuando faltan columnas/tablas o CHECK antiguo (migración 002 no aplicada). */
function isSchemaMismatchError(e) {
    const any = e;
    const code = any?.code;
    const errno = any?.errno;
    return (code === 'ER_BAD_FIELD_ERROR' ||
        code === 'ER_NO_SUCH_TABLE' ||
        code === 'ER_CHECK_CONSTRAINT_VIOLATED' ||
        errno === 3819);
}
