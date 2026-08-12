-- ===========================================================================
-- 005_probability_engine_v2.sql
-- Motor de probabilidades v2: presupuesto absoluto, métricas globales, auditoría
-- Ejecutar después de 004_campanas_param_avanzados.sql
-- ===========================================================================

SET @db := DATABASE();

-- presupuesto_total + modo + config JSON en campaigns
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'presupuesto_total');
SET @sql := IF(@exist = 0,
  "ALTER TABLE campaigns ADD COLUMN presupuesto_total DECIMAL(18,2) NULL COMMENT 'NULL = solo control ratio' AFTER pct_tope_costo",
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'presupuesto_modo');
SET @sql := IF(@exist = 0,
  "ALTER TABLE campaigns ADD COLUMN presupuesto_modo ENUM('ratio','absoluto','mixto') NOT NULL DEFAULT 'ratio' AFTER presupuesto_total",
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'probability_config_json');
SET @sql := IF(@exist = 0,
  'ALTER TABLE campaigns ADD COLUMN probability_config_json JSON NULL AFTER presupuesto_modo',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Métricas agregadas por campaña (todos los vendedores)
CREATE TABLE IF NOT EXISTS campaign_metrics_global (
  campaign_id CHAR(36) PRIMARY KEY,
  ventas_elegibles_acum DECIMAL(18,2) NOT NULL DEFAULT 0,
  bonos_emitidos_acum DECIMAL(18,2) NOT NULL DEFAULT 0,
  bonos_comprometidos_reserva DECIMAL(18,2) NOT NULL DEFAULT 0,
  participaciones_count INT NOT NULL DEFAULT 0,
  ganadores_count INT NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cmg_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Auditoría de cada decisión probabilística
CREATE TABLE IF NOT EXISTS probability_audit_log (
  id CHAR(36) PRIMARY KEY,
  participacion_id CHAR(36) NULL,
  campaign_id CHAR(36) NOT NULL,
  usuario VARCHAR(100) NOT NULL,
  factura_numero VARCHAR(50) NOT NULL,
  valor_elegible DECIMAL(14,2) NOT NULL,
  bono_valor_estimado DECIMAL(14,2) NOT NULL,
  prob_base DECIMAL(10,8) NOT NULL,
  prob_final DECIMAL(10,8) NOT NULL,
  V_vendedor DECIMAL(18,2) NOT NULL,
  B_vendedor DECIMAL(18,2) NOT NULL,
  V_campana DECIMAL(18,2) NULL,
  B_campana DECIMAL(18,2) NULL,
  headroom_ratio DECIMAL(18,2) NULL,
  headroom_absoluto DECIMAL(18,2) NULL,
  random_u DECIMAL(10,8) NULL,
  gano TINYINT(1) NOT NULL,
  motivo_bloqueo VARCHAR(200) NULL,
  config_snapshot JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_campaign (campaign_id, created_at),
  INDEX idx_audit_factura (factura_numero),
  INDEX idx_audit_participacion (participacion_id)
) ENGINE=InnoDB;

-- Inicializar métricas globales para campañas existentes
INSERT IGNORE INTO campaign_metrics_global (campaign_id)
SELECT id FROM campaigns;
