-- Migración 001: preparación Clean Architecture / producción

-- 1) Idempotencia (client_id)
ALTER TABLE ventas ADD COLUMN client_id CHAR(36) NULL;
ALTER TABLE participaciones ADD COLUMN client_id CHAR(36) NULL;

-- Backfill opcional (solo si quieres): dejar null para históricos.

CREATE UNIQUE INDEX ux_ventas_client_id ON ventas(client_id);
CREATE UNIQUE INDEX ux_participaciones_client_id ON participaciones(client_id);

-- 2) Consecutivos con bloqueo
CREATE TABLE IF NOT EXISTS consecutivos (
  nombre VARCHAR(50) PRIMARY KEY,
  valor INT NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO consecutivos (nombre, valor) VALUES ('FACTURA_2024', 0);

-- 3) Auditoría
CREATE TABLE IF NOT EXISTS auditoria_eventos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo_evento VARCHAR(50) NOT NULL,
  usuario_id CHAR(36) NULL,
  payload JSON NOT NULL,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

