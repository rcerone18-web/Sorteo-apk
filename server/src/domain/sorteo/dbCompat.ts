/** Errores MySQL típicos cuando faltan columnas/tablas o CHECK antiguo (migración 002 no aplicada). */
export function isSchemaMismatchError(e: unknown): boolean {
  const any = e as { code?: string; errno?: number };
  const code = any?.code;
  const errno = any?.errno;
  return (
    code === 'ER_BAD_FIELD_ERROR' ||
    code === 'ER_NO_SUCH_TABLE' ||
    code === 'ER_CHECK_CONSTRAINT_VIOLATED' ||
    errno === 3819
  );
}
