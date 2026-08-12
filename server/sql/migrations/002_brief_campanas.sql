-- Brief promocional: campañas, métricas, idempotencia participación, estados bono, trazabilidad
-- Ejecutar después de 001_clean_arch.sql y sorteo_db_mysql.sql base

SET @db := DATABASE();

-- ---------------------------------------------------------------------------
-- Campañas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id CHAR(36) PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  min_subtotal_elegible DECIMAL(14,2) NOT NULL DEFAULT 0,
  pct_bono DECIMAL(10,6) NOT NULL COMMENT 'Ej: 0.5 = 50% del valor elegible',
  pct_tope_costo DECIMAL(10,6) NOT NULL COMMENT 'Máx bonos emitidos / ventas elegibles',
  bono_vigencia_dias INT NOT NULL DEFAULT 30,
  probabilidad_base DECIMAL(10,8) NOT NULL DEFAULT 0.1,
  estado ENUM('activa', 'inactiva') NOT NULL DEFAULT 'activa',
  refs_elegibles_json TEXT NOT NULL COMMENT '[] = todas las referencias',
  leyenda_factura_bono VARCHAR(500) NOT NULL DEFAULT 'ESTA FACTURA CONTIENE UN BONO',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS campaign_users (
  campaign_id CHAR(36) NOT NULL,
  usuario VARCHAR(100) NOT NULL,
  PRIMARY KEY (campaign_id, usuario),
  CONSTRAINT fk_cu_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS campaign_metrics (
  campaign_id CHAR(36) NOT NULL,
  usuario VARCHAR(100) NOT NULL,
  ventas_elegibles_acum DECIMAL(18,2) NOT NULL DEFAULT 0,
  bonos_emitidos_acum DECIMAL(18,2) NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (campaign_id, usuario),
  CONSTRAINT fk_cm_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Campaña por defecto (ajusta fechas en producción)
INSERT IGNORE INTO campaigns (
  id, nombre, fecha_inicio, fecha_fin, min_subtotal_elegible, pct_bono, pct_tope_costo,
  bono_vigencia_dias, probabilidad_base, estado, refs_elegibles_json, leyenda_factura_bono
) VALUES (
  'c0000001-0000-0000-0000-000000000001',
  'Campaña principal',
  '2020-01-01',
  '2035-12-31',
  0,
  0.5,
  0.15,
  30,
  0.1,
  'activa',
  '[]',
  'ESTA FACTURA CONTIENE UN BONO'
);

INSERT IGNORE INTO campaign_users (campaign_id, usuario)
SELECT 'c0000001-0000-0000-0000-000000000001', usuario FROM users;

-- ---------------------------------------------------------------------------
-- Ventas: elegibilidad y estado
-- ---------------------------------------------------------------------------
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'valor_elegible');
SET @sql := IF(@exist = 0,
  'ALTER TABLE ventas ADD COLUMN valor_elegible DECIMAL(14,2) NULL AFTER valor',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'campaign_id');
SET @sql := IF(@exist = 0,
  'ALTER TABLE ventas ADD COLUMN campaign_id CHAR(36) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'estado');
SET @sql := IF(@exist = 0,
  "ALTER TABLE ventas ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'emitida'",
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- facturas_mock: valor elegible
-- ---------------------------------------------------------------------------
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'facturas_mock' AND COLUMN_NAME = 'valor_elegible');
SET @sql := IF(@exist = 0,
  'ALTER TABLE facturas_mock ADD COLUMN valor_elegible DECIMAL(14,2) NULL AFTER valor',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- participaciones: idempotencia y auditoría
-- ---------------------------------------------------------------------------
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'participaciones' AND COLUMN_NAME = 'idempotency_key');
SET @sql := IF(@exist = 0,
  'ALTER TABLE participaciones ADD COLUMN idempotency_key CHAR(36) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'participaciones' AND COLUMN_NAME = 'campaign_id');
SET @sql := IF(@exist = 0,
  'ALTER TABLE participaciones ADD COLUMN campaign_id CHAR(36) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'participaciones' AND COLUMN_NAME = 'valor_elegible');
SET @sql := IF(@exist = 0,
  'ALTER TABLE participaciones ADD COLUMN valor_elegible DECIMAL(14,2) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'participaciones' AND COLUMN_NAME = 'probabilidad_utilizada');
SET @sql := IF(@exist = 0,
  'ALTER TABLE participaciones ADD COLUMN probabilidad_utilizada DECIMAL(14,10) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'participaciones' AND INDEX_NAME = 'ux_participaciones_idempotency');
SET @sql := IF(@exist = 0,
  'CREATE UNIQUE INDEX ux_participaciones_idempotency ON participaciones (idempotency_key)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- sorteos: probabilidad usada
-- ---------------------------------------------------------------------------
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sorteos' AND COLUMN_NAME = 'probabilidad_utilizada');
SET @sql := IF(@exist = 0,
  'ALTER TABLE sorteos ADD COLUMN probabilidad_utilizada DECIMAL(14,10) NULL AFTER ganador',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- bonos: estados brief + trazabilidad redención
-- (MySQL 8.0.16+: quitar CHECK antiguo; si falla, ejecutar manualmente:
--  ALTER TABLE bonos DROP CHECK chk_estado_bono; )
-- ---------------------------------------------------------------------------
ALTER TABLE bonos DROP CHECK chk_estado_bono;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'bonos' AND COLUMN_NAME = 'saldo_restante');
SET @sql := IF(@exist = 0,
  'ALTER TABLE bonos ADD COLUMN saldo_restante DECIMAL(14,2) NULL AFTER valor',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'bonos' AND COLUMN_NAME = 'valor_elegible_origen');
SET @sql := IF(@exist = 0,
  'ALTER TABLE bonos ADD COLUMN valor_elegible_origen DECIMAL(14,2) NULL AFTER saldo_restante',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'bonos' AND COLUMN_NAME = 'campaign_id');
SET @sql := IF(@exist = 0,
  'ALTER TABLE bonos ADD COLUMN campaign_id CHAR(36) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'bonos' AND COLUMN_NAME = 'factura_redencion');
SET @sql := IF(@exist = 0,
  'ALTER TABLE bonos ADD COLUMN factura_redencion VARCHAR(50) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE bonos SET saldo_restante = valor WHERE saldo_restante IS NULL;
UPDATE bonos SET valor_elegible_origen = valor WHERE valor_elegible_origen IS NULL;
UPDATE bonos SET estado = 'vigente' WHERE estado = 'disponible';

ALTER TABLE bonos MODIFY COLUMN estado VARCHAR(20) NOT NULL;
