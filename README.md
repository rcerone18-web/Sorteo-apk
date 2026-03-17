# Sorteo Promocional – App móvil APK

Aplicación Android (APK) para punto de venta: registro de ventas, participación en sorteo, resultado (ganó / no ganó, bono 50 %) y sincronización con servidor. Funciona **online**, **offline** y con **sincronización manual**.

## Stack

- **App:** React Native (Expo SDK 52), TypeScript, SQLite local (expo-sqlite), React Navigation.
- **Backend de ejemplo:** Node.js + Express + SQLite (incluido en `/server`). Puedes reemplazarlo por tu API actual (Node/Express + MySQL, etc.).

## Requisitos

- Node.js 18+
- npm o yarn
- Para generar APK: cuenta en [Expo](https://expo.dev) (EAS Build) o entorno Android local (Android Studio + JDK).

## Instalación y ejecución

### 1. Dependencias de la app

```bash
cd c:\Users\renec\Desktop\Sorteo-apk
npm install
```

### 2. Configurar URL del servidor

La app usa la URL del API desde la configuración de Expo.

**Opción A – Archivo de entorno**

Crea un archivo `.env` en la raíz del proyecto:

```
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

Sustituye por la IP o dominio de tu servidor (sin barra final). En desarrollo con emulador Android, `localhost` suele no funcionar; usa la IP de tu PC en la red local.

**Opción B – Modificar `app.config.js`**

En `app.config.js`, en la sección `extra`:

```js
extra: {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://TU_IP:3000',
},
```

### 3. Levantar el servidor de ejemplo (opcional)

Si usas el backend incluido:

```bash
cd server
npm install
npm start
```

Por defecto corre en `http://0.0.0.0:3000`. Usuarios demo: **asesor** / **asesor123** y **admin** / **admin123** (rol administrador).

### 4. Ejecutar la app en desarrollo

```bash
npx expo start
```

Luego escanea el QR con Expo Go (Android) o pulsa `a` para abrir en emulador Android. Para probar contra el servidor en tu PC, configura `EXPO_PUBLIC_API_URL` con la IP de tu máquina.

## Cómo generar el APK

### Con EAS Build (recomendado)

1. Instala EAS CLI y entra con tu cuenta Expo:

   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Configura el proyecto (si es la primera vez):

   ```bash
   eas build:configure
   ```

3. Genera un APK de preview (instalable sin Play Store):

   ```bash
   eas build --platform android --profile preview
   ```

4. Descarga el APK desde el enlace que muestra EAS o desde [expo.dev](https://expo.dev).

Para que la URL del API sea la de producción en el APK, define `EXPO_PUBLIC_API_URL` en los **secrets** de EAS o en el perfil de build antes de ejecutar `eas build`.

### Con build local (Android Studio)

```bash
npx expo run:android
```

Genera y ejecuta en dispositivo/emulador. Para obtener un APK firmado, abre el proyecto Android en Android Studio y usa *Build > Build Bundle(s) / APK(s) > Build APK(s)*.

## Cómo probar modo offline

1. Con la app abierta y ya logueado, **desactiva WiFi y datos** (o pon el dispositivo en modo avión).
2. Registra una venta: se guardará con número local (ej. `F-LOCAL-001`).
3. Entra a **Participación**, escribe el número `F-LOCAL-001` y pierde el foco del campo: se autocompletarán fecha, valor, cédula y nombre desde la base local.
4. Acepta consentimiento y envía: el sorteo se ejecuta en el dispositivo y verás el resultado (ganó / no ganó). Verás el aviso de que se confirmará al sincronizar.
5. Vuelve a activar internet y en la pestaña **Sincronizar** pulsa **Sincronizar datos**. Primero se envían las ventas pendientes (el servidor devuelve el número real) y luego las participaciones, reemplazando `F-LOCAL-xxx` por el número real.

## Estructura del proyecto

- `App.tsx` – Punto de entrada y proveedores (Auth, Sync).
- `src/navigation/AppNavigator.tsx` – Navegación (login, tabs, pantalla resultado).
- `src/context/` – AuthContext (login, token, sesión), SyncContext (estado online, pendientes, sincronización).
- `src/db/` – SQLite local: ventas, participaciones, mapeo local→real, configuración cacheada.
- `src/api/client.ts` – Cliente HTTP (login, ventas, participaciones, config, admin).
- `src/sync/syncService.ts` – Detección de red, envío de pendientes, orden ventas → participaciones.
- `src/screens/` – Login, Facturación, Participación, Resultado Sorteo, Sincronizar, Admin.
- `server/` – API de ejemplo (sustituible por tu backend).

## API esperada por la app

La app consume estos endpoints cuando hay conexión (sustituye por tu backend real):

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Body: `{ usuario, clave }`. Devuelve `{ token, usuario }`. |
| POST | `/api/ventas` | Body: cedula, nombreCliente, valorTotal, fechaFactura, totalHuevos?, presentaciones `[{ presentacion, cantidad }]`, codigoBono?. Devuelve `{ numero }`. |
| GET | `/api/ventas/por-numero/:numero` | Devuelve datos de la factura para autocompletar. |
| GET | `/api/participaciones/validar-factura/:numero` | Valida que la factura esté en facturas_mock y no haya participado. |
| POST | `/api/participaciones` | Body: facturaNumero, fechaFactura, cedula, nombreCliente, valorTotal, consentimiento. Devuelve `{ gana, codigoBono?, compraMinimaBono?, mensaje }`. |
| GET | `/api/config/sorteo` | Devuelve `{ probabilidadGanar, compraMinimaBono, presentacionesParticipan }`. |
| GET | `/api/admin/metricas` | Solo admin. Total ventas, participaciones, ganadores, bonos redimidos. |
| GET | `/api/admin/facturas` | Solo admin. Listado de facturas. |
| GET | `/api/admin/participaciones` | Solo admin. Listado de participaciones. |
| PUT | `/api/admin/config/sorteo` | Solo admin. Actualizar configuración del sorteo. |

Todas las rutas excepto login deben enviar header `Authorization: Bearer <token>`.

## Licencia

Uso interno / según tu proyecto.
