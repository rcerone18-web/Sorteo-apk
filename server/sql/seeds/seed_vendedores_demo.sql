-- ===========================================================================
-- seed_vendedores_demo.sql
-- Inserta 10 asesores de prueba (idempotente).
--
-- Convenciones:
--   - usuario: vendedor01 .. vendedor10
--   - clave:   vendedor123  (texto plano: el login legacy compara directo)
--   - rol:     asesor
--   - nombre:  "Vendedor 01" .. "Vendedor 10"
--   - id:      a0000010-..010 .. a0000019-..019  (estable para reruns)
--
-- Además los asigna a la "Campaña principal" (id = c0000001-...001) para que
-- aparezcan en la asignación de vendedores y puedan participar.
-- ===========================================================================

INSERT IGNORE INTO users (id, usuario, password_hash, rol, nombre) VALUES
  ('a0000010-0000-0000-0000-000000000010', 'vendedor01', 'vendedor123', 'asesor', 'Vendedor 01'),
  ('a0000011-0000-0000-0000-000000000011', 'vendedor02', 'vendedor123', 'asesor', 'Vendedor 02'),
  ('a0000012-0000-0000-0000-000000000012', 'vendedor03', 'vendedor123', 'asesor', 'Vendedor 03'),
  ('a0000013-0000-0000-0000-000000000013', 'vendedor04', 'vendedor123', 'asesor', 'Vendedor 04'),
  ('a0000014-0000-0000-0000-000000000014', 'vendedor05', 'vendedor123', 'asesor', 'Vendedor 05'),
  ('a0000015-0000-0000-0000-000000000015', 'vendedor06', 'vendedor123', 'asesor', 'Vendedor 06'),
  ('a0000016-0000-0000-0000-000000000016', 'vendedor07', 'vendedor123', 'asesor', 'Vendedor 07'),
  ('a0000017-0000-0000-0000-000000000017', 'vendedor08', 'vendedor123', 'asesor', 'Vendedor 08'),
  ('a0000018-0000-0000-0000-000000000018', 'vendedor09', 'vendedor123', 'asesor', 'Vendedor 09'),
  ('a0000019-0000-0000-0000-000000000019', 'vendedor10', 'vendedor123', 'asesor', 'Vendedor 10');

-- Si existe la campaña principal por defecto, los autoasigna (idempotente).
INSERT IGNORE INTO campaign_users (campaign_id, usuario)
SELECT 'c0000001-0000-0000-0000-000000000001', usuario
FROM users
WHERE usuario IN (
  'vendedor01','vendedor02','vendedor03','vendedor04','vendedor05',
  'vendedor06','vendedor07','vendedor08','vendedor09','vendedor10'
)
AND EXISTS (SELECT 1 FROM campaigns WHERE id = 'c0000001-0000-0000-0000-000000000001');
