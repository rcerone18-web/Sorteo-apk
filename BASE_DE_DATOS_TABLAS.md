# Base de datos Sorteo Promocional – Tablas para reutilizar en el otro sistema (APK)

El otro sistema (app móvil APK) debe usar **la misma base de datos** en el servidor, es decir las **mismas tablas** y estructura. El servidor actual es **MySQL**; la base se llama **sorteo_db**. Conexión vía **DATABASE_URL** en `.env`.

---

## 1. Tablas y estructura

### 1.1 `users`
Usuarios que inician sesión en la app (venteros y administrador).

| Columna        | Tipo         | Restricciones | Descripción                    |
|----------------|--------------|---------------|--------------------------------|
| id             | CHAR(36)     | PRIMARY KEY   | UUID                           |
| usuario        | VARCHAR(100) | UNIQUE NOT NULL | Login                        |
| password_hash  | VARCHAR(255) | NOT NULL      | Contraseña hasheada (bcrypt)   |
| rol            | VARCHAR(50)  | NOT NULL      | 'administrador' o 'asesor'     |
| nombre         | VARCHAR(200) | NOT NULL     | Nombre para mostrar            |
| created_at     | DATETIME     | DEFAULT NOW() | Fecha de creación             |

---

### 1.2 `ventas`
Cada venta/factura registrada desde la app. El `numero` es el que se usa en participaciones y en `facturas_mock` cuando la venta no redimió bono.

| Columna               | Tipo         | Restricciones | Descripción                          |
|-----------------------|--------------|---------------|--------------------------------------|
| id                    | CHAR(36)     | PRIMARY KEY   | UUID                                 |
| numero                | VARCHAR(50)  | UNIQUE NOT NULL | Número de factura (ej. F-2024-076) |
| fecha                 | DATE         | NOT NULL      | Fecha de la factura                  |
| cedula                | VARCHAR(20)  | NOT NULL      | Cédula del cliente                   |
| nombre_cliente        | VARCHAR(200) | NOT NULL     | Nombre del cliente                   |
| valor                 | DECIMAL(14,2)| NOT NULL, > 0 | Valor total                          |
| total_huevos          | INT          | NULL          | Total de huevos (opcional)           |
| presentaciones_detalle| TEXT         | NULL          | JSON con [{ presentacion, cantidad }]|
| created_at            | DATETIME     | DEFAULT NOW() | Fecha de registro                   |

---

### 1.3 `facturas_mock`
Facturas válidas para participar en el sorteo. Cuando se registra una venta **sin** redimir bono, el servidor inserta una fila aquí con el mismo `numero` que en `ventas`. Si la venta redimió bono, **no** se inserta aquí (esa factura no participa).

| Columna | Tipo         | Restricciones   | Descripción        |
|---------|--------------|-----------------|--------------------|
| id      | INT          | AUTO_INCREMENT PK |                  |
| numero  | VARCHAR(50)  | UNIQUE NOT NULL | Número de factura  |
| fecha   | DATE         | NOT NULL        | Fecha              |
| valor   | DECIMAL(14,2)| NOT NULL, > 0   | Valor              |

---

### 1.4 `participaciones`
Participaciones en el sorteo (una por factura).

| Columna          | Tipo         | Restricciones | Descripción                    |
|------------------|--------------|---------------|--------------------------------|
| id               | CHAR(36)     | PRIMARY KEY   | UUID                           |
| factura_numero   | VARCHAR(50)  | NOT NULL      | Número de factura (de ventas/facturas_mock) |
| fecha_factura    | DATE         | NOT NULL      | Fecha de la factura            |
| cedula           | VARCHAR(20)  | NOT NULL      | Cédula del cliente             |
| nombre_cliente   | VARCHAR(200) | NOT NULL     | Nombre del cliente             |
| valor_total      | DECIMAL(14,2)| NOT NULL, > 0 | Valor total                    |
| consentimiento   | TINYINT(1)   | NOT NULL      | 1 = sí aceptó                  |
| fecha_registro   | DATETIME     | DEFAULT NOW() | Cuándo se registró            |
| usuario_registro | VARCHAR(100) | NOT NULL     | Usuario que registró           |

---

### 1.5 `sorteos`
Resultado del sorteo por participación (ganó o no).

| Columna          | Tipo     | Restricciones | Descripción                    |
|------------------|----------|---------------|--------------------------------|
| id               | CHAR(36) | PRIMARY KEY   | UUID                           |
| participacion_id | CHAR(36) | NOT NULL, FK→participaciones | Id de la participación |
| ganador          | TINYINT(1)| NOT NULL     | 1 = ganó, 0 = no ganó          |
| fecha_sorteo     | DATETIME | DEFAULT NOW() | Cuándo se ejecutó el sorteo   |
| usuario          | VARCHAR(100) | NOT NULL   | Usuario que ejecutó            |

---

### 1.6 `bonos`
Bonos de 50 % para próxima compra; se crean cuando el cliente gana el sorteo.

| Columna           | Tipo     | Restricciones | Descripción                         |
|-------------------|----------|---------------|-------------------------------------|
| id                | CHAR(36) | PRIMARY KEY   | UUID                                |
| codigo            | VARCHAR(20) | UNIQUE NOT NULL | Código que ve el cliente (redimir) |
| factura_origen    | VARCHAR(50) | NOT NULL    | Factura con la que participó        |
| cedula            | VARCHAR(20) | NOT NULL    | Cédula del cliente                  |
| nombre_cliente    | VARCHAR(200) | NOT NULL   | Nombre del cliente                  |
| valor             | DECIMAL(14,2) | NOT NULL, > 0 | Valor referencia (ej. mitad)     |
| fecha_emision     | DATETIME | DEFAULT NOW()  | Fecha de emisión                   |
| fecha_vencimiento| DATETIME | NOT NULL       | Hasta cuándo puede redimir        |
| estado            | VARCHAR(20) | NOT NULL     | 'disponible', 'redimido', 'vencido'|
| participacion_id  | CHAR(36) | NOT NULL, FK→participaciones | Participación ganadora      |

---

### 1.7 `config_sorteo`
Configuración clave–valor del sorteo.

| Columna | Tipo        | Restricciones | Descripción |
|---------|-------------|---------------|-------------|
| clave   | VARCHAR(50) | PRIMARY KEY   | Nombre de la config |
| valor   | TEXT        | NOT NULL      | Valor (número o JSON) |

**Claves usadas:**

| clave                        | Ejemplo valor | Uso |
|-----------------------------|---------------|-----|
| probabilidad_ganar          | 0.1           | Probabilidad de ganar (0.1 = 10 %) |
| compra_minima               | 100000        | Compra mínima en pesos para redimir bono |
| presentaiones_para_participar| ["EXTRA","AA"]| JSON: presentaciones que permiten participar |
| requiere_extra_o_aa         | 0 o 1         | Compatibilidad (1 = requiere Extra o AA) |

---

## 2. Relaciones entre tablas

- **ventas** → no tiene FK; el servidor genera `numero` único (p. ej. siguiente a `facturas_mock.id` o `ventas.numero`).
- **facturas_mock** → lista de facturas que **sí** pueden participar; se inserta una fila por cada venta que **no** redimió bono.
- **participaciones** → `factura_numero` debe existir en `facturas_mock` (una factura solo participa una vez).
- **sorteos** → `participacion_id` → `participaciones.id` (una fila por participación).
- **bonos** → `participacion_id` → `participaciones.id` (solo si esa participación ganó).

---

## 3. Flujo que debe respetar el otro sistema (APK)

1. **Venta (factura)**  
   - Insertar en `ventas` (id, numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle).  
   - Si **no** se redimió bono en esa venta → insertar también en `facturas_mock` (numero, fecha, valor).  
   - Si **sí** se redimió bono → no insertar en `facturas_mock` (esa factura no participa).

2. **Participación**  
   - Comprobar que `factura_numero` exista en `facturas_mock` y no esté ya en `participaciones`.  
   - Insertar en `participaciones`.  
   - Insertar en `sorteos` (participacion_id, ganador 0/1, usuario).  
   - Si ganador = 1 → crear bono en `bonos` (codigo único, participacion_id, etc.).

3. **Redención de bono**  
   - Al registrar una venta con código de bono: buscar bono por `codigo`, verificar `estado = 'disponible'` y que la venta cumpla `compra_minima`; actualizar bono a `estado = 'redimido'`. Esa venta no debe insertarse en `facturas_mock`.

4. **Configuración**  
   - Leer/escribir `config_sorteo` para probabilidad, compra mínima y presentaciones que participan; la app móvil debe usar los mismos criterios al validar y al sincronizar.

---

## 4. API REST actual (mismo servidor, misma BD)

El APK debe consumir el **mismo backend** (mismas tablas). Endpoints relevantes:

- **Auth:** POST `/api/auth/login` (usuario, clave) → token.
- **Ventas:** POST `/api/ventas` (cedula, nombreCliente, valorTotal, fechaFactura, totalHuevos, presentaciones, codigoBono opcional) → respuesta con `numero` de factura.
- **Participaciones:** GET `/api/participaciones/validar-factura/:numero`; POST `/api/participaciones` (facturaNumero, fechaFactura, cedula, nombreCliente, valorTotal, consentimiento) → ejecuta sorteo y devuelve gana, participacion, bono.
- **Config:** GET `/api/ventas/config/compra-minima`; en admin, GET/PUT para probabilidad, compra mínima, presentaciones.

Al sincronizar desde el APK: enviar ventas pendientes (POST `/api/ventas`) y participaciones pendientes (POST `/api/participaciones`) en ese orden; el servidor escribirá en estas mismas tablas.

---

## 5. Resumen para el prompt del APK

- Base de datos: **MySQL**, base **sorteo_db**.
- Tablas a usar (sin cambiar nombres ni estructura): **users**, **ventas**, **facturas_mock**, **participaciones**, **sorteos**, **bonos**, **config_sorteo**.
- El APK se conecta al **mismo servidor** y mismo API; solo debe enviar los mismos payloads y respetar las mismas reglas de negocio (factura con bono no participa, una factura una participación, etc.) para que las tablas sigan siendo compartidas y coherentes.
