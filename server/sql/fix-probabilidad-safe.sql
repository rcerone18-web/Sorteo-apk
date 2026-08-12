-- Ajusta probabilidad ~100% a 10%. Funciona aunque NO exista la tabla `campaigns`.
-- Uso: desde HeidiSQL o: .\scripts\apply-probabilidad-fix.ps1

UPDATE config_sorteo
SET valor = '0.1'
WHERE clave = 'probabilidad_ganar';

SET @hay_campaigns := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'campaigns'
);

SET @sql := IF(
  @hay_campaigns > 0,
  'UPDATE campaigns SET probabilidad_base = 0.1 WHERE probabilidad_base >= 0.95',
  'SELECT ''Tabla campaigns no existe: omitido (aplica 002_brief_campanas.sql cuando puedas)'' AS mensaje'
);

PREPARE _stmt FROM @sql;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;
