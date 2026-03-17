# Prompt: Descripción completa de la aplicación Sorteo Promocional

## 1. Propósito y contexto

**Sorteo Promocional** es una aplicación móvil (APK) para **registrar ventas** y **gestionar un sorteo** asociado a facturas: los clientes que compren y cumplan reglas configurables pueden participar en un sorteo; si ganan, reciben un **bono de 50%** para la próxima compra, canjeable solo por el ganador (cédula y nombre). La app funciona **online** contra un backend API y **offline** con SQLite local, sincronizando después.

- **Usuarios:** asesores (venteros) y administradores. Login por usuario/contraseña; JWT en el cliente.
- **Backend:** API REST en Node.js (Express), base de datos **MySQL** (`sorteo_db`), gestor típico Laragon/HeidiSQL.

---

## 2. Stack técnico

- **Cliente:** React Native con **Expo** (~54), TypeScript, React Navigation (Stack + Bottom Tabs), Axios, AsyncStorage, SQLite (expo-sqlite), detección de red (expo-network).
- **Servidor:** Node.js, Express, CORS, JWT, **mysql2** (pool), dotenv. Puerto por defecto 3000.
- **Base de datos:** MySQL con tablas: `users`, `ventas`, `facturas_mock`, `participaciones`, `sorteos`, `bonos`, `config_sorteo`. Script SQL en `server/sql/sorteo_db_mysql.sql`.

---

## 3. Navegación y pantallas

- **Stack raíz:** Login (sin header) → Main (tabs) y, desde ahí, pantalla **Resultado del sorteo** (ruleta y mensaje).
- **Tabs principales (Main):**
  - **Ventas (Facturación):** formulario de venta por ítems/presentaciones y opcional código de bono.
  - **Sorteo (Participación):** validar factura, consentimiento, ejecutar sorteo (ruleta) y ver resultado.
  - **Sync:** estado online/offline, pendientes de ventas y participaciones, botón sincronizar y mensajes de error claros.
  - **Admin** (solo rol administrador): dashboard, listados (participaciones, sorteos, ganadores, bonos), redención manual de bonos, **Configuración** (compra mínima, probabilidad de ganar, presentaciones que pueden participar).
- **Diseño de cabecera/tabs:** fondo cabecera `#1e3a5f`, texto blanco, tabs activo `#2563eb`, inactivo `#64748b`. Fondos de pantalla claros (`#f1f5f9`), inputs blancos con borde `#e2e8f0`, botones primarios azul `#2563eb`, mensajes de éxito/descuento en verdes (`#ecfdf5`, `#065f46`), errores/avisos en rojos/naranjas.

---

## 4. Funcionalidad por módulo

### 4.1 Login
- Campos usuario y clave; envía `POST /api/auth/login`. Guarda token y usuario (id, usuario, rol, nombre) en AsyncStorage y restaura sesión al abrir la app.

### 4.2 Facturación (Ventas)
- **Autocompletar:** por número de factura (carga venta y datos) o por cédula (solo nombre del cliente, sin productos).
- **Datos del cliente:** cédula, nombre, fecha factura, total huevos opcional.
- **Código bono (opcional):** al salir del campo se obtiene la compra mínima del servidor; si el total de ítems ≥ compra mínima se muestra **descuento 50%** (subtotal, descuento, total a pagar). Si no alcanza, se muestra mensaje indicando la compra mínima requerida.
- **Ítems:** lista de presentaciones (EXTRA, AA, A, B, PIPO, etc.) con cantidad y precio por cartón; subtotales y total recalculados. Botón agregar/quitar ítem.
- **Guardar:** online → `POST /api/ventas` (cedula, nombreCliente, valorTotal, fechaFactura, totalHuevos, presentaciones, codigoBono opcional). Offline → guarda en SQLite y marca pendiente de sincronizar. Tras guardar, opción “Ir a participación” con número de factura.
- **Seguridad bono:** el servidor valida que el código exista, esté disponible, no vencido, compra ≥ compra mínima y que **cedula y nombreCliente coincidan con el ganador** del bono; si no, 403.

### 4.3 Participación en el sorteo
- **Datos:** número de factura (con autocompletar por número), fecha, cédula, nombre, valor total, checkbox consentimiento.
- **Validar:** al participar (online) se llama antes a `GET /api/participaciones/validar-factura/:numero`. Si la factura no está en `facturas_mock` o no cumple **presentaciones permitidas** (config Admin), se muestra error; si hay lista de presentaciones requeridas, se muestran en el mensaje.
- **Sorteo:** online → `POST /api/participaciones`; offline → sorteo local y guardado en SQLite. Ruleta animada (ganaste / no ganaste).
- **Tras la ruleta:** botón “Registrar otra venta” cierra el modal y navega a Facturación; si ganó, botón “Ver resultado” abre pantalla **Resultado del sorteo** (ruleta, mensaje, código de bono si aplica, compra mínima para redimir). Esa pantalla redirige automáticamente a Ventas tras unos segundos.

### 4.4 Sincronizar
- Muestra estado online/offline y cantidad de ventas y participaciones pendientes. Al sincronizar: primero ventas pendientes (`POST /api/ventas`), mapeo número local → número real; luego participaciones pendientes (`POST /api/participaciones`), traduciendo F-LOCAL-* al número real si existe mapeo. Errores mostrados con mensajes claros (404/403 por factura no participa o presentaciones, etc.).

### 4.5 Administración
- **Dashboard:** métricas (total participaciones, ganadores, tasa observada, valor emitido/redimido en bonos).
- **Listados:** participaciones, sorteos, ganadores, bonos (filtros por fechas, cliente, factura, estado).
- **Redención:** lista de bonos disponibles; el admin puede marcar bono como redimido manualmente.
- **Configuración:** compra mínima para redimir bono (pesos); probabilidad de ganar; **presentaciones que pueden participar** (lista de nombres; si está vacía, cualquier factura puede participar; si no, solo facturas con al menos un ítem de esa lista).

---

## 5. Reglas de negocio (resumen)

- Una factura participa **solo si** está en `facturas_mock` (venta sin bono redimido) y cumple presentaciones permitidas (si las hay).
- Una factura participa **una sola vez** en el sorteo.
- Bono: **un solo uso**, asociado a cédula y nombre del ganador; compra mínima configurable; vencimiento (ej. 1 mes).
- Número de factura: generado en servidor de forma secuencial (ej. F-2024-001) para evitar duplicados al reiniciar.
- Offline: ventas y participaciones se guardan localmente y se sincronizan cuando hay conexión; participaciones con F-LOCAL-* se traducen al número real tras sincronizar la venta correspondiente.

---

## 6. API (resumen)

- **Auth:** `POST /api/auth/login` (usuario, clave) → token y usuario.
- **Ventas:** `POST /api/ventas` (cedula, nombreCliente, valorTotal, fechaFactura, totalHuevos?, presentaciones, codigoBono?) → numero. Validación de bono por código, cédula, nombre, compra mínima y estado.
- **Participaciones:** `GET /api/participaciones/validar-factura/:numero`; `POST /api/participaciones` (facturaNumero, fechaFactura, cedula, nombreCliente, valorTotal, consentimiento). Validación de presentaciones y lista en 403.
- **Config:** `GET /api/ventas/config/compra-minima`; `GET /api/config/sorteo` (probabilidad, compra mínima, presentaciones).
- **Admin:** métricas, listados de facturas/participaciones/sorteos/bonos, PATCH redimir bono, GET/PUT de probabilidad, compra mínima y presentaciones que pueden participar.

Todas las rutas protegidas (salvo login) usan cabecera `Authorization: Bearer <token>`.

---

## 7. Diseño visual (resumen)

- **Paleta:** azul oscuro cabecera/navegación (`#1e3a5f`), azul primario botones/activo (`#2563eb`), grises para inactivo y bordes (`#64748b`, `#e2e8f0`), fondo general claro (`#f1f5f9`), éxito/descuento verde (`#ecfdf5`, `#065f46`), errores/alertas rojo/naranja.
- **Formularios:** secciones con título en negrita; inputs con borde redondeado; botones primarios redondeados; modales para selector de presentación y ruleta.
- **Ruleta:** dos mitades (ganaste / no ganaste), flecha fija; texto de estado debajo; botones “Registrar otra venta” y “Ver resultado” cuando aplica.
- **Listas admin:** filas con datos en celdas; opción exportar CSV donde aplica.

---

## 8. Uso de este prompt

Puedes usar este documento como **prompt** para que un asistente o equipo entienda de un vistazo la aplicación completa: qué hace, cómo está estructurada, qué reglas sigue y cómo es la experiencia de uso y el diseño, tanto en la app móvil como en el backend y la base de datos.
