-- ===========================================================================
-- 004_campanas_param_avanzados.sql
-- Extiende `campaigns` con los parámetros adicionales del brief promocional:
--   - bono_un_solo_uso              (1 = el bono se consume en una sola redención;
--                                    si el cliente usa solo una parte, pierde el saldo)
--   - bono_no_acumulable            (1 = no se puede combinar con otros bonos/promos)
--   - redencion_solo_factura_futura (1 = el bono nunca se aplica en la misma factura origen)
--   - redencion_min_igual_origen    (1 = la nueva compra debe tener al menos
--                                    el valor elegible de la factura origen)
--
-- Idempotente: usa INFORMATION_SCHEMA para no fallar si ya existen.
-- Ejecutar después de 002_brief_campanas.sql
-- ===========================================================================

SET @db := DATABASE();

-- bono_un_solo_uso ------------------------------------------------------------
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'bono_un_solo_uso');
SET @sql := IF(@exist = 0,
  'ALTER TABLE campaigns ADD COLUMN bono_un_solo_uso TINYINT(1) NOT NULL DEFAULT 1 AFTER leyenda_factura_bono',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- bono_no_acumulable ----------------------------------------------------------
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'bono_no_acumulable');
SET @sql := IF(@exist = 0,
  'ALTER TABLE campaigns ADD COLUMN bono_no_acumulable TINYINT(1) NOT NULL DEFAULT 1 AFTER bono_un_solo_uso',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- redencion_solo_factura_futura ----------------------------------------------
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'redencion_solo_factura_futura');
SET @sql := IF(@exist = 0,
  'ALTER TABLE campaigns ADD COLUMN redencion_solo_factura_futura TINYINT(1) NOT NULL DEFAULT 1 AFTER bono_no_acumulable',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- redencion_min_igual_origen --------------------------------------------------
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'redencion_min_igual_origen');
SET @sql := IF(@exist = 0,
  'ALTER TABLE campaigns ADD COLUMN redencion_min_igual_origen TINYINT(1) NOT NULL DEFAULT 1 AFTER redencion_solo_factura_futura',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- updated_at ------------------------------------------------------------------
-- Útil para auditoría desde el dashboard admin (modificar campaña, etc.)
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'updated_at');
SET @sql := IF(@exist = 0,
  'ALTER TABLE campaigns ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
