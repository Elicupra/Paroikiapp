# TESTING — Paroikiapp

> Versión: 1.0 — Iteración 1
> Este fichero define el plan de pruebas completo de Paroikiapp.
> Un agente que lo lea debe ser capaz de ejecutar las pruebas indicadas,
> verificar los resultados esperados y reportar el estado de cada una.

---

## Instrucciones para el Agente

### Antes de ejecutar pruebas

1. Verificar que el entorno está levantado: `docker compose up -d`
2. Verificar que la BD tiene las migraciones aplicadas: `npm run migrate --prefix backend`
3. Ejecutar el seed de pruebas: `npm run seed:test --prefix backend`
4. Confirmar que los servicios responden: `curl -f http://localhost/api/public/eventos`

### Cómo reportar resultados

Para cada prueba, registrar:
- `✅ PASS` — comportamiento coincide con el esperado
- `❌ FAIL` — comportamiento no coincide; detallar la diferencia
- `⚠️ SKIP` — prueba no ejecutable en el entorno actual; indicar motivo

### Datos de prueba (seed de test)

```
Admin:         admin@paroikiapp.test  /  Admin1234!
Monitor A:     monitor.a@test.com    /  Monitor1234!   (asignado a Evento 1)
Monitor B:     monitor.b@test.com    /  Monitor1234!   (NO asignado a Evento 1)
Evento 1:      "Campamento Test"     precio_base: 150, coste_cero: false
Evento 2:      "Viaje Cero"          precio_base: 0,   coste_cero: true
Token Monitor A para Evento 1: definido en seed como UUID fijo para reproducibilidad
```

---

## Suite 1 — Autenticación

### T1.01 — Login correcto
```
POST /api/auth/login
{ "email": "admin@paroikiapp.test", "password": "Admin1234!" }
```
**Esperado:** 200 · body contiene `{ token: "..." }` · cookie `refreshToken` httpOnly establecida

### T1.02 — Login con contraseña incorrecta
```
POST /api/auth/login
{ "email": "admin@paroikiapp.test", "password": "incorrecta" }
```
**Esperado:** 401 · mensaje genérico (no distingue si el usuario existe o no)

### T1.03 — Login con usuario inexistente
```
POST /api/auth/login
{ "email": "noexiste@test.com", "password": "cualquiera" }
```
**Esperado:** 401 · **mismo mensaje** que T1.02 (no revelar existencia del usuario)

### T1.04 — Refresh de token válido
```
POST /api/auth/refresh  (con cookie refreshToken válida de T1.01)
```
**Esperado:** 200 · nuevo JWT de acceso en body · nueva cookie refreshToken

### T1.05 — Refresh con token inválido
```
POST /api/auth/refresh  (con cookie refreshToken manipulada o expirada)
```
**Esperado:** 401

### T1.06 — Logout invalida el refresh token
```
1. POST /api/auth/login → obtener refreshToken
2. POST /api/auth/logout
3. POST /api/auth/refresh con el mismo refreshToken
```
**Esperado paso 3:** 401 (el token ya no existe en BD)

### T1.07 — Rate limiting en login
```
POST /api/auth/login  ×6 seguidas con credenciales incorrectas desde la misma IP
```
**Esperado en intento 6:** 429 Too Many Requests

### T1.08 — Cambio de contraseña
```
PATCH /api/auth/me/password  [Auth: admin]
{ "currentPassword": "Admin1234!", "newPassword": "NuevaPass456!" }
```
**Esperado:** 200 · todos los refresh tokens del usuario invalidados

### T1.09 — Cambio de email
```
PATCH /api/auth/me/email  [Auth: admin]
{ "password": "NuevaPass456!", "newEmail": "admin.nuevo@test.com" }
```
**Esperado:** 200 · login posterior funciona con el nuevo email

### T1.10 — Intento de cambio de nombre_mostrado (prohibido)
```
PATCH /api/auth/me  [Auth: admin]  (si existiera el endpoint)
{ "nombre_mostrado": "Hackeado" }
```
**Esperado:** 404 o 405 (el endpoint no debe existir)

---

## Suite 2 — Control de Acceso por Rol

### T2.01 — Monitor no puede acceder a rutas de admin
```
GET /api/admin/eventos  [Auth: Monitor A]
```
**Esperado:** 403

### T2.02 — Admin puede acceder a rutas de monitor
```
GET /api/monitor/eventos  [Auth: admin]
```
**Esperado:** 200

### T2.03 — Monitor solo ve sus eventos asignados
```
GET /api/monitor/eventos  [Auth: Monitor B]
```
**Esperado:** 200 · lista vacía (Monitor B no tiene eventos asignados)

### T2.04 — Monitor no puede ver jóvenes de otro monitor
```
1. Registrar Joven1 con token de Monitor A
2. GET /api/monitor/jovenes/:joven1_id  [Auth: Monitor B]
```
**Esperado:** 403 o 404

### T2.05 — Sin token, las rutas protegidas rechazan
```
GET /api/monitor/eventos  (sin Authorization header)
```
**Esperado:** 401

### T2.06 — Token expirado rechazado
```
GET /api/monitor/eventos  (con JWT con exp en el pasado)
```
**Esperado:** 401

---

## Suite 3 — Registro Público del Joven

### T3.01 — Acceso con token de monitor válido
```
GET /register/:monitor_a_token
```
**Esperado:** 200 · info del evento (nombre, tipo, fechas) · sin datos de otros jóvenes

### T3.02 — Acceso con token inválido
```
GET /register/00000000-0000-0000-0000-000000000000
```
**Esperado:** 404

### T3.03 — Registro de joven exitoso
```
POST /register/:monitor_a_token/joven
{ "nombre": "Ana", "apellidos": "García López" }
```
**Esperado:** 201 · body contiene `{ joven_id, enlace_personal }` · `enlace_personal` es una URL completa con UUID

### T3.04 — El joven queda asociado al monitor correcto
```
Tras T3.03:
GET /api/monitor/jovenes  [Auth: Monitor A]
```
**Esperado:** lista incluye a "Ana García López"

### T3.05 — Registro con datos incompletos
```
POST /register/:monitor_a_token/joven
{ "nombre": "Ana" }  (falta apellidos)
```
**Esperado:** 400 con mensaje de validación

### T3.06 — Subida de documento en el momento del registro
```
POST /register/:monitor_a_token/joven/:joven_id/documento
Multipart: { tipo: "autorizacion_paterna", file: <PDF válido> }
```
**Esperado:** 201 · documento asociado al joven

### T3.07 — Subida de tipo de archivo no permitido
```
POST /register/:monitor_a_token/joven/:joven_id/documento
Multipart: { tipo: "tarjeta_sanitaria", file: <archivo .exe> }
```
**Esperado:** 400 · mensaje "tipo de archivo no permitido"

### T3.08 — Subida de archivo mayor de 5 MB
```
POST /register/:monitor_a_token/joven/:joven_id/documento
Multipart: { tipo: "autorizacion_paterna", file: <archivo de 6 MB> }
```
**Esperado:** 413

### T3.09 — Límite de jóvenes por monitor (max_jovenes)
```
1. Configurar max_jovenes = 2 para Monitor A en Evento 1
2. Registrar Joven1 y Joven2
3. Intentar registrar Joven3
```
**Esperado en paso 3:** 403 · mensaje indicando que el grupo está completo

### T3.10 — Token de monitor revocado no permite registro
```
1. Admin revoca token de Monitor A: POST /api/admin/monitores/:id/eventos/:evento_id/revocar-enlace
2. GET /register/:token_antiguo
```
**Esperado:** 404 o 403

---

## Suite 4 — Ficha Personal del Joven

### T4.01 — Acceso a ficha con token válido
```
GET /ficha/:joven_token
```
**Esperado:** 200 · datos del joven (nombre, apellidos, documentos subidos) · sin datos de otros jóvenes

### T4.02 — Acceso a ficha con token inválido
```
GET /ficha/00000000-0000-0000-0000-000000000000
```
**Esperado:** 404 · **mismo mensaje** que si el token fuera válido pero sin datos (no revelar existencia)

### T4.03 — Modificación de datos desde la ficha
```
PATCH /ficha/:joven_token
{ "nombre": "Ana María", "apellidos": "García López" }
```
**Esperado:** 200 · datos actualizados en BD

### T4.04 — Subida de documento desde la ficha
```
POST /ficha/:joven_token/documento
Multipart: { tipo: "tarjeta_sanitaria", file: <imagen PNG válida> }
```
**Esperado:** 201

### T4.05 — El token del joven no permite acceder a datos de otro joven
```
GET /ficha/:joven_token  (con token de Joven1 intentando acceder a datos de Joven2)
```
**Nota:** cada token solo da acceso a su propio joven; esto es implícito por diseño pero debe verificarse
**Esperado:** solo se devuelven datos del joven propietario del token

### T4.06 — Eliminación de documento
```
DELETE /ficha/:joven_token/documento/:doc_id
```
**Esperado:** 200 · documento eliminado de BD y del sistema de archivos

---

## Suite 5 — Panel del Monitor

### T5.01 — Ver lista de jóvenes del propio grupo
```
GET /api/monitor/jovenes  [Auth: Monitor A]
```
**Esperado:** 200 · lista de jóvenes del Monitor A únicamente

### T5.02 — Ver recaudación del propio grupo
```
GET /api/monitor/eventos/:evento_id/recaudacion  [Auth: Monitor A]
```
**Esperado:** 200 · { recaudado: N, esperado: M, por_joven: [...] }

### T5.03 — Registrar pago normal
```
POST /api/monitor/pagos  [Auth: Monitor A]
{ "joven_id": ":id_joven_propio", "plazo_numero": 1, "cantidad": 50 }
```
**Esperado:** 201

### T5.04 — Registrar pago especial sin nota (debe fallar)
```
POST /api/monitor/pagos  [Auth: Monitor A]
{ "joven_id": ":id", "plazo_numero": 2, "cantidad": 30, "es_especial": true }
```
**Esperado:** 400 · "nota_especial es obligatoria para pagos especiales"

### T5.05 — Registrar pago especial con nota
```
POST /api/monitor/pagos  [Auth: Monitor A]
{ "joven_id": ":id", "plazo_numero": 2, "cantidad": 30, "es_especial": true, "nota_especial": "Beca parcial" }
```
**Esperado:** 201

### T5.06 — Monitor no puede registrar pago de joven de otro monitor
```
POST /api/monitor/pagos  [Auth: Monitor B]
{ "joven_id": ":id_joven_de_monitor_a", ... }
```
**Esperado:** 403

### T5.07 — Editar datos de un joven propio
```
PATCH /api/monitor/jovenes/:id  [Auth: Monitor A]
{ "nombre": "Ana María" }
```
**Esperado:** 200

### T5.08 — Eliminar joven propio
```
DELETE /api/monitor/jovenes/:id  [Auth: Monitor A]
```
**Esperado:** 200 · el joven y sus documentos/pagos son eliminados o marcados como eliminados

---

## Suite 6 — Panel de Administrador

### T6.01 — Crear tipo de evento
```
POST /api/admin/tipos-evento  [Auth: admin]
{ "nombre": "Retiro" }
```
**Esperado:** 201 · tipo creado con id UUID

### T6.02 — Crear evento con precio mayor que 0
```
POST /api/admin/eventos  [Auth: admin]
{ "nombre": "Retiro Otoño", "tipo_evento_id": ":id", "precio_base": 80, "fecha_inicio": "2026-10-01" }
```
**Esperado:** 201 · `coste_cero: false`

### T6.03 — Crear evento con precio 0 (requiere confirmación)
```
POST /api/admin/eventos  [Auth: admin]
{ "nombre": "Evento Gratuito", "tipo_evento_id": ":id", "precio_base": 0, "confirmar_coste_cero": true }
```
**Esperado:** 201 · `coste_cero: true`

### T6.04 — Crear evento con precio 0 sin confirmación (debe fallar)
```
POST /api/admin/eventos  [Auth: admin]
{ "nombre": "Evento Gratuito", "tipo_evento_id": ":id", "precio_base": 0 }
```
**Esperado:** 400 · "Confirma que el evento es gratuito (confirmar_coste_cero: true)"

### T6.05 — Crear usuario monitor
```
POST /api/admin/usuarios  [Auth: admin]
{ "email": "nuevo.monitor@test.com", "nombre_mostrado": "Carlos Ruiz", "rol": "monitor", "password_temporal": "Temp1234!" }
```
**Esperado:** 201 · usuario creado · puede hacer login con esas credenciales

### T6.06 — Asignar evento a monitor
```
POST /api/admin/monitores/:id/eventos  [Auth: admin]
{ "evento_id": ":evento_id", "max_jovenes": 10 }
```
**Esperado:** 200 · monitor puede ver el evento desde su panel

### T6.07 — Ver recaudación global de un evento
```
GET /api/admin/eventos/:id/recaudacion  [Auth: admin]
```
**Esperado:** 200 · { total_recaudado, total_esperado, por_monitor: [{ monitor_id, nombre, recaudado, esperado, total_jovenes }] }

### T6.08 — Revocar enlace de monitor
```
POST /api/admin/monitores/:id/eventos/:evento_id/revocar-enlace  [Auth: admin]
```
**Esperado:** 200 · nuevo `enlace_token` en respuesta · el token anterior ya no funciona (verificar con T3.10)

### T6.09 — Reajustar precio de evento
```
PATCH /api/admin/eventos/:id  [Auth: admin]
{ "precio_base": 120, "descuento_global": 20 }
```
**Esperado:** 200 · precio efectivo = 100 · reflejado en recaudación esperada

---

## Suite 7 — Seguridad

### T7.01 — SQL Injection en login
```
POST /api/auth/login
{ "email": "' OR '1'='1", "password": "cualquiera" }
```
**Esperado:** 401 (no 200; la query no debe ser manipulable)

### T7.02 — SQL Injection en búsqueda de jóvenes
```
GET /api/monitor/jovenes?nombre='; DROP TABLE jovenes; --  [Auth: Monitor A]
```
**Esperado:** 200 con lista vacía o 400 · la tabla `jovenes` sigue existiendo tras la petición

### T7.03 — Path traversal en descarga de documento
```
GET /api/documentos/../../../etc/passwd  [Auth: admin]
```
**Esperado:** 400 o 404 · nunca 200 con el contenido del archivo

### T7.04 — Acceso a documento de otro joven
```
1. Subir documento como Joven1 → obtener doc_id
2. GET /api/documentos/:doc_id  [Auth: Monitor B]  (Monitor B no gestiona a Joven1)
```
**Esperado:** 403

### T7.05 — Cabeceras de seguridad presentes
```
GET /  (cualquier endpoint)
```
**Esperado:** respuesta incluye: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` (en HTTPS)

### T7.06 — CORS rechaza origen no autorizado
```
GET /api/monitor/eventos
Origin: https://sitio-malicioso.com
```
**Esperado:** respuesta sin `Access-Control-Allow-Origin` o con error CORS

### T7.07 — Archivo con extensión falsa rechazado
```
POST /ficha/:joven_token/documento
Multipart: { tipo: "autorizacion_paterna", file: <archivo .exe renombrado a .pdf> }
```
**Esperado:** 400 · el sistema detecta el MIME type real y rechaza

---

## Suite 8 — Eventos con Coste Cero

### T8.01 — Evento coste cero no muestra precios en respuesta
```
GET /api/monitor/eventos/:evento_cero_id  [Auth: monitor asignado]
```
**Esperado:** respuesta no incluye campos `precio_base`, `precio_efectivo`, `recaudado`, `esperado`

### T8.02 — No se pueden registrar pagos en evento coste cero
```
POST /api/monitor/pagos  [Auth: monitor]
{ "joven_id": ":joven_en_evento_cero", "plazo_numero": 1, "cantidad": 0 }
```
**Esperado:** 400 · "Este evento no tiene gestión de pagos"

---

## Suite 9 — Notificaciones

### T9.01 — Email enviado al registrar joven (requiere SMTP configurado)
```
1. Configurar SMTP en .env de test
2. POST /register/:monitor_a_token/joven { nombre, apellidos }
3. Verificar bandeja del monitor
```
**Esperado:** email recibido con asunto "Nuevo participante: {nombre} {apellidos}" · sin datos sensibles en el cuerpo

### T9.02 — Email no bloquea el registro si SMTP falla
```
1. Configurar SMTP_HOST con servidor inválido
2. POST /register/:monitor_a_token/joven { nombre, apellidos }
```
**Esperado:** 201 (el registro se completa) · error de email logueado en consola pero no propagado al cliente

---

## Checklist de Ejecución

Marcar con `[x]` las suites completadas en cada ciclo de pruebas:

```
Fecha de ejecución: ___________
Entorno: [ ] Local  [ ] Staging  [ ] Producción
Ejecutado por: ___________

[ ] Suite 1 — Autenticación          (10 tests)
[ ] Suite 2 — Control de Acceso      (6 tests)
[ ] Suite 3 — Registro del Joven     (10 tests)
[ ] Suite 4 — Ficha Personal         (6 tests)
[ ] Suite 5 — Panel Monitor          (8 tests)
[ ] Suite 6 — Panel Admin            (9 tests)
[ ] Suite 7 — Seguridad              (7 tests)
[ ] Suite 8 — Coste Cero             (2 tests)
[ ] Suite 9 — Notificaciones         (2 tests)

Total: 60 tests
PASS: ___  FAIL: ___  SKIP: ___
```

---

## Notas para el Agente

- Si una Suite de Seguridad falla, **detener el despliegue** y notificar al responsable antes de continuar
- Los tests de Suite 7 deben ejecutarse siempre, incluso en entorno de desarrollo
- Suite 9 puede marcarse como SKIP si no hay SMTP disponible en el entorno de pruebas
- Ante un FAIL en T2.04, T4.05 o T7.04 (acceso cruzado de datos), tratar como incidente de seguridad
