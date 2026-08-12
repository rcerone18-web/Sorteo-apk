-- ============================================================
-- Sorteo Promocional – Base de datos MySQL para Laragon/HeidiSQL
-- Ejecutar este script completo en HeidiSQL (conexión MySQL).
-- ============================================================

CREATE DATABASE IF NOT EXISTS sorteo_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sorteo_db;

-- --------------------------------------------------------------
-- 1. users
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  usuario VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_rol CHECK (rol IN ('administrador', 'asesor'))
) ENGINE=InnoDB;

-- --------------------------------------------------------------
-- 2. ventas
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
  id CHAR(36) PRIMARY KEY,
  numero VARCHAR(50) NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  cedula VARCHAR(20) NOT NULL,
  nombre_cliente VARCHAR(200) NOT NULL,
  valor DECIMAL(14,2) NOT NULL CHECK (valor > 0),
  total_huevos INT NULL,
  presentaciones_detalle TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- --------------------------------------------------------------
-- 3. facturas_mock
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facturas_mock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(50) NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  valor DECIMAL(14,2) NOT NULL CHECK (valor > 0)
) ENGINE=InnoDB;

-- --------------------------------------------------------------
-- 4. participaciones
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participaciones (
  id CHAR(36) PRIMARY KEY,
  factura_numero VARCHAR(50) NOT NULL,
  fecha_factura DATE NOT NULL,
  cedula VARCHAR(20) NOT NULL,
  nombre_cliente VARCHAR(200) NOT NULL,
  valor_total DECIMAL(14,2) NOT NULL CHECK (valor_total > 0),
  consentimiento TINYINT(1) NOT NULL,
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  usuario_registro VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

-- --------------------------------------------------------------
-- 5. sorteos
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sorteos (
  id CHAR(36) PRIMARY KEY,
  participacion_id CHAR(36) NOT NULL,
  ganador TINYINT(1) NOT NULL,
  fecha_sorteo DATETIME DEFAULT CURRENT_TIMESTAMP,
  usuario VARCHAR(100) NOT NULL,
  CONSTRAINT chk_ganador CHECK (ganador IN (0, 1))
) ENGINE=InnoDB;

-- --------------------------------------------------------------
-- 6. bonos
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bonos (
  id CHAR(36) PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  factura_origen VARCHAR(50) NOT NULL,
  cedula VARCHAR(20) NOT NULL,
  nombre_cliente VARCHAR(200) NOT NULL,
  valor DECIMAL(14,2) NOT NULL CHECK (valor > 0),
  fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_vencimiento DATETIME NOT NULL,
  estado VARCHAR(20) NOT NULL,
  participacion_id CHAR(36) NOT NULL,
  CONSTRAINT chk_estado_bono CHECK (estado IN ('disponible', 'redimido', 'vencido'))
) ENGINE=InnoDB;

-- --------------------------------------------------------------
-- 7. config_sorteo
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config_sorteo (
  clave VARCHAR(50) PRIMARY KEY,
  valor TEXT NOT NULL
) ENGINE=InnoDB;

-- --------------------------------------------------------------
-- Datos iniciales
-- --------------------------------------------------------------
INSERT IGNORE INTO config_sorteo (clave, valor) VALUES
  ('probabilidad_ganar', '0.1'),
  ('compra_minima', '100000'),
  ('min_subtotal_refs_participar', '0'),
  ('presentaiones_para_participar', '[]'),
  ('requiere_extra_o_aa', '0');

-- Usuarios demo (contraseñas en texto; en producción usar bcrypt)
INSERT IGNORE INTO users (id, usuario, password_hash, rol, nombre) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'asesor', 'asesor123', 'asesor', 'Asesor Demo'),
  ('a0000002-0000-0000-0000-000000000002', 'admin', 'admin123', 'administrador', 'Admin Demo');

-- ============================================================
-- Fin del script. Conectar el servidor Node con:
-- host: 127.0.0.1 (o localhost), user, password, database: sorteo_db
-- ============================================================
