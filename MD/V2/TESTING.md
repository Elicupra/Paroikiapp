# TESTING — Paroikiapp

> Versión: 2.0 — Iteración 2
> Plan de pruebas ejecutable por agente o desarrollador.
> Un agente debe ejecutar las suites en orden y reportar resultados antes de cualquier merge a main.

---

## Instrucciones para el Agente

### Preparación del entorno
```bash
docker compose up -d
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed:test   # datos de prueba reproducibles
curl -f http://localhost/api/public/eventos      # verificar que el backend responde
```

### Datos de prueba (seed:test)
```
Admin:         admin@paroikiapp.test  /  Admin1234!
Monitor A:     monitor.a@test.com    /  Monitor1234!   (asignado a Evento 1)
Monitor B:     monitor.b@test.com    /  Monitor1234!   (NO asignado a Evento 1)
Evento 1:      "Campamento Test"     precio_base: 150, coste_cero: false, visible_publico: true
Evento 2:      "Viaje Cero"          precio_base: 0,   coste_cero: true,  visible_publico: true
Evento 3:      "Retiro Interno"      precio_base: 80,  coste_cero: false, visible_publico: false
Token Monitor A → Evento 1: UUID fijo definido en seed para reproducibilidad
```

### Cómo reportar
- `✅ PASS` — comportamiento coincide con el esperado
- `❌ FAIL` — indicar diferencia concreta entre esperado y obtenido
- `⚠️ SKIP` — no ejecutable en el entorno; indicar motivo

### Prioridad de suites
Suite 7 (Seguridad) y Suite 10 (CORS y Errores): **detener despliegue si hay FAILs**
Suites 1-6: bloquean merge si hay más de 2 FAILs
Suites 8-13: pueden tener SKIPs si el entorno no está completo

---

## Suite 1 — Autenticación

### T1.01 — Login correcto
```
POST /api/auth/login  { email: "admin@paroikiapp.test", password: "Admin1234!" }
Esperado: 200 · { token } · cookie refreshToken httpOnly
```

### T1.02 — Login con contraseña incorrecta
```
POST /api/auth/login  { email: "admin@paroikiapp.test", password: "incorrecta" }
Esperado: 401 · mensaje genérico (no distingue usuario/contraseña)
```

### T1.03 — Login con usuario inexistente
```
POST /api/auth/login  { email: "noexiste@test.com", password: "cualquiera" }
Esperado: 401 · mismo mensaje que T1.02 exactamente
```

### T1.04 — Refresh de token válido
```
POST /api/auth/refresh  (cookie refreshToken de T1.01)
Esperado: 200 · nuevo JWT · nueva cookie refreshToken
```

### T1.05 — Refresh con token inválido
```
POST /api/auth/refresh  (cookie manipulada)
Esperado: 401
```

### T1.06 — Logout invalida el refresh token
```
1. Login → refreshToken
2. POST /api/auth/logout
3. POST /api/auth/refresh con el mismo refreshToken
Esperado paso 3: 401
```

### T1.07 — Rate limiting en login
```
POST /api/auth/login ×6 seguidas con credenciales incorrectas (misma IP)
Esperado en intento 6: 429
```

### T1.08 — Cambio de nombre_mostrado
```
PATCH /api/auth/me/profile  [Auth: admin]  { nombre_mostrado: "Admin Nuevo" }
Esperado: 200 · nombre actualizado en BD
```

### T1.09 — Cambio de contraseña invalida refresh tokens
```
PATCH /api/auth/me/password  [Auth: admin]  { currentPassword, newPassword }
Luego: POST /api/auth/refresh con el token antiguo
Esperado en refresh: 401
```

### T1.10 — Cambio de email
```
PATCH /api/auth/me/email  [Auth: admin]  { password, newEmail: "admin2@test.com" }
Luego: login con nuevo email
Esperado: 200 · login funciona con nuevo email
```

---

## Suite 2 — Control de Acceso por Rol

### T2.01 — Monitor no accede a rutas de admin
```
GET /api/admin/eventos  [Auth: Monitor A]
Esperado: 403
```

### T2.02 — Admin accede a rutas de monitor
```
GET /api/monitor/eventos  [Auth: admin]
Esperado: 200
```

### T2.03 — Monitor sin eventos asignados ve lista vacía
```
GET /api/monitor/eventos  [Auth: Monitor B]
Esperado: 200 · data: []
```

### T2.04 — Monitor no ve jóvenes de otro monitor
```
1. Registrar Joven1 con token de Monitor A
2. GET /api/monitor/jovenes/:joven1_id  [Auth: Monitor B]
Esperado: 403 o 404
```

### T2.05 — Sin token → 401
```
GET /api/monitor/eventos  (sin Authorization header)
Esperado: 401
```

### T2.06 — Token expirado → 401
```
GET /api/monitor/eventos  (JWT con exp en el pasado)
Esperado: 401
```

---

## Suite 3 — Registro Público del Joven

### T3.01 — Info del evento por token de monitor
```
GET /register/:monitor_a_token
Esperado: 200 · { evento: { nombre, tipo, fecha_inicio, fecha_fin } } · sin datos de otros jóvenes
```

### T3.02 — Token inválido
```
GET /register/00000000-0000-0000-0000-000000000000
Esperado: 404
```

### T3.03 — Registro exitoso
```
POST /register/:monitor_a_token/joven  { nombre: "Ana", apellidos: "García López" }
Esperado: 201 · { joven_id, enlace_personal }  (URL completa con UUID)
```

### T3.04 — Joven asociado al monitor correcto
```
GET /api/monitor/jovenes  [Auth: Monitor A]
Esperado: incluye a "Ana García López"
```

### T3.05 — Registro incompleto
```
POST /register/:monitor_a_token/joven  { nombre: "Ana" }
Esperado: 400 con campo de error específico
```

### T3.06 — Subida de documento en registro
```
POST /register/:monitor_a_token/joven/:jovenId/documento
Multipart: { tipo: "autorizacion_paterna", file: <PDF válido> }
Esperado: 201
```

### T3.07 — Archivo no permitido
```
Multipart: { tipo: "tarjeta_sanitaria", file: <archivo .exe> }
Esperado: 400 "tipo de archivo no permitido"
```

### T3.08 — Archivo mayor de 5 MB
```
Multipart: { file: <6 MB> }
Esperado: 413
```

### T3.09 — Límite de jóvenes (max_jovenes)
```
1. Configurar max_jovenes = 2 para Monitor A en Evento 1
2. Registrar Joven1 y Joven2
3. Intentar Joven3
Esperado paso 3: 403 "El grupo de este monitor está completo"
```

### T3.10 — Token de monitor revocado
```
1. Admin revoca token: POST /api/admin/monitores/:id/eventos/:eventoId/revocar-enlace
2. GET /register/:token_antiguo
Esperado: 404 o 403
```

---

## Suite 4 — Ficha Personal del Joven

### T4.01 — Acceso con token válido
```
GET /ficha/:joven_token
Esperado: 200 · { nombre, apellidos, documentos[] } · sin datos de otros jóvenes
```

### T4.02 — Token inválido → mismo 404 que token válido sin datos
```
GET /ficha/00000000-0000-0000-0000-000000000000
Esperado: 404 · mensaje idéntico al de token válido inexistente
```

### T4.03 — Modificar datos
```
PATCH /ficha/:joven_token  { nombre: "Ana María", apellidos: "García López" }
Esperado: 200 · datos actualizados en BD
```

### T4.04 — Subida de documento
```
POST /ficha/:joven_token/documento  Multipart: { tipo: "tarjeta_sanitaria", file: <PNG> }
Esperado: 201
```

### T4.05 — Un token no accede a otro joven
```
Verificar que /ficha/:token_joven1 nunca devuelve datos de joven2
Esperado: solo datos del propietario del token
```

### T4.06 — Eliminación de documento
```
DELETE /ficha/:joven_token/documento/:docId
Esperado: 200 · eliminado de BD y sistema de archivos
```

---

## Suite 5 — Panel del Monitor

### T5.01 — Lista de jóvenes propios
```
GET /api/monitor/jovenes  [Auth: Monitor A]
Esperado: solo jóvenes de Monitor A
```

### T5.02 — Recaudación del grupo
```
GET /api/monitor/eventos/:eventoId/recaudacion  [Auth: Monitor A]
Esperado: { recaudado, esperado, por_joven: [] }
```

### T5.03 — Pago normal
```
POST /api/monitor/pagos  [Auth: Monitor A]
{ joven_id: ":propio", plazo_numero: 1, cantidad: 50 }
Esperado: 201
```

### T5.04 — Pago especial sin nota (debe fallar)
```
{ joven_id: ":id", plazo_numero: 2, cantidad: 30, es_especial: true }
Esperado: 400 "nota_especial es obligatoria para pagos especiales"
```

### T5.05 — Pago especial con nota
```
{ ..., es_especial: true, nota_especial: "Beca parcial" }
Esperado: 201
```

### T5.06 — Monitor no registra pago de joven ajeno
```
POST /api/monitor/pagos  [Auth: Monitor B]  { joven_id: ":de_monitor_a", ... }
Esperado: 403
```

### T5.07 — Editar joven propio
```
PATCH /api/monitor/jovenes/:id  [Auth: Monitor A]  { nombre: "Ana María" }
Esperado: 200
```

### T5.08 — Eliminar joven propio
```
DELETE /api/monitor/jovenes/:id  [Auth: Monitor A]
Esperado: 200
```

### T5.09 — Fichero privado del monitor (NUEVO — Iter. 2)
```
POST /api/monitor/ficheros  [Auth: Monitor A]  Multipart: { file: <PDF> }
Esperado: 201 · { fichero_id }
```

### T5.10 — Fichero privado no visible para otro monitor (NUEVO — Iter. 2)
```
GET /api/monitor/ficheros  [Auth: Monitor B]
Esperado: lista sin ficheros de Monitor A
```

---

## Suite 6 — Panel de Administrador

### T6.01 — Crear tipo de evento
```
POST /api/admin/tipos-evento  [Auth: admin]  { nombre: "Retiro" }
Esperado: 201
```

### T6.02 — Crear evento con precio > 0
```
POST /api/admin/eventos  { nombre: "Retiro Otoño", tipo_evento_id: ":id", precio_base: 80 }
Esperado: 201 · coste_cero: false
```

### T6.03 — Crear evento precio 0 con confirmación
```
{ nombre: "Gratuito", precio_base: 0, confirmar_coste_cero: true }
Esperado: 201 · coste_cero: true
```

### T6.04 — Crear evento precio 0 sin confirmación
```
{ nombre: "Gratuito", precio_base: 0 }
Esperado: 400 "Confirma que el evento es gratuito"
```

### T6.05 — Crear usuario monitor
```
POST /api/admin/usuarios  { email, nombre_mostrado, rol: "monitor", password_temporal }
Esperado: 201 · login funciona con esas credenciales
```

### T6.06 — Asignar evento a monitor
```
POST /api/admin/monitores/:id/eventos  { evento_id, max_jovenes: 10 }
Esperado: 200 · monitor ve el evento desde su panel
```

### T6.07 — Recaudación global del evento
```
GET /api/admin/eventos/:id/recaudacion  [Auth: admin]
Esperado: { total_recaudado, total_esperado, por_monitor: [] }
```

### T6.08 — Revocar enlace de monitor
```
POST /api/admin/monitores/:id/eventos/:eventoId/revocar-enlace
Esperado: 200 · nuevo enlace_token · token antiguo → 404
```

### T6.09 — Dashboard global (NUEVO — Iter. 2)
```
GET /api/admin/dashboard  [Auth: admin]
Esperado: { total_eventos, total_monitores, total_jovenes, recaudacion_global }
```

### T6.10 — Mini-dashboard de monitor (NUEVO — Iter. 2)
```
GET /api/admin/monitores/:id/dashboard  [Auth: admin]
Esperado: { eventos[], jovenes_por_evento[], recaudacion }
```

---

## Suite 7 — Seguridad

### T7.01 — SQL Injection en login
```
{ email: "' OR '1'='1", password: "cualquiera" }
Esperado: 401 · tabla usuarios intacta
```

### T7.02 — SQL Injection en búsqueda
```
GET /api/monitor/jovenes?nombre='; DROP TABLE jovenes; --  [Auth: Monitor A]
Esperado: 200 lista vacía o 400 · tabla jovenes existe tras la petición
```

### T7.03 — Path traversal en descarga
```
GET /api/documentos/../../../etc/passwd  [Auth: admin]
Esperado: 400 o 404 · nunca contenido del fichero
```

### T7.04 — Acceso a documento de otro joven
```
1. Joven1 sube documento → doc_id
2. GET /api/documentos/:doc_id  [Auth: Monitor B]
Esperado: 403
```

### T7.05 — Cabeceras de seguridad
```
GET /api/public/eventos
Esperado: X-Content-Type-Options: nosniff · X-Frame-Options: DENY · (HSTS en HTTPS)
```

### T7.06 — CORS rechaza origen no autorizado
```
GET /api/monitor/eventos  Origin: https://sitio-malicioso.com  [Auth: Monitor A]
Esperado: sin Access-Control-Allow-Origin o error CORS
```

### T7.07 — Archivo con extensión falsa rechazado
```
Multipart: { file: <.exe renombrado a .pdf> }
Esperado: 400 · MIME type real detectado
```

### T7.08 — Fichero privado de monitor no accesible por otro monitor (NUEVO — Iter. 2)
```
GET /api/monitor/ficheros  [Auth: Monitor B] → no debe ver ficheros de Monitor A
GET /api/admin/monitores/:monitorA_id/ficheros  [Auth: Monitor B]
Esperado ambos: 403
```

---

## Suite 8 — Eventos con Coste Cero

### T8.01 — Evento coste cero no expone precios en API
```
GET /api/monitor/eventos/:evento_cero_id  [Auth: monitor asignado]
Esperado: sin precio_base, precio_efectivo, recaudado, esperado en la respuesta
```

### T8.02 — No se pueden registrar pagos en evento coste cero
```
POST /api/monitor/pagos  { joven_id: ":en_evento_cero", plazo_numero: 1, cantidad: 0 }
Esperado: 400 "Este evento no tiene gestión de pagos"
```

---

## Suite 9 — Notificaciones

### T9.01 — Email al registrar joven (requiere SMTP configurado)
```
POST /register/:token/joven { nombre, apellidos }
Verificar bandeja del monitor
Esperado: email con asunto "Nuevo participante: {nombre}" · sin datos sensibles
```

### T9.02 — Email no bloquea registro si SMTP falla
```
Configurar SMTP_HOST inválido
POST /register/:token/joven { nombre, apellidos }
Esperado: 201 (registro completo) · error de email en consola del servidor
```

---

## Suite 10 — CORS y Gestión de Errores (NUEVO — Iter. 2)

### T10.01 — Error CORS registrado en log del servidor
```
GET /api/monitor/eventos  Origin: https://evil.com  [Auth: Monitor A]
Verificar log del servidor
Esperado: entrada de log con IP, origen rechazado, timestamp
```

### T10.02 — Error CORS devuelve cabecera X-Error-Reason
```
GET /api/monitor/eventos  Origin: https://evil.com
Esperado: cabecera X-Error-Reason: cors-rejected en la respuesta
```

### T10.03 — Fetch fallido muestra toast en frontend
```
Simular backend caído (detener servicio backend)
Acceder a /eventos en el frontend con sesión activa
Esperado: toast rojo "Error de conexión. Inténtalo de nuevo." visible en pantalla
```

### T10.04 — 401 redirige a login
```
Navegar a /admin con JWT expirado
Esperado: redirección a /login + toast "Sesión expirada"
```

### T10.05 — 403 muestra toast naranja
```
Monitor A intenta POST /api/admin/eventos
Esperado: toast naranja "No tienes permisos para esta acción"
```

### T10.06 — 400 muestra error inline en formulario
```
POST /api/admin/eventos  con nombre vacío (desde UI)
Esperado: mensaje de error bajo el campo "nombre" en el formulario · no toast global
```

### T10.07 — Spinner durante fetch
```
Abrir /eventos en frontend con conexión lenta
Esperado: spinner visible mientras se carga · desaparece al completar
```

### T10.08 — Ninguna acción silenciosa
```
Ejecutar todas las acciones de UI (botones, formularios) con backend respondiendo correctamente
Verificar que TODAS las acciones tienen:
  - Spinner mientras procesan
  - Toast de éxito o error al completar
  - Ninguna termina sin feedback visual
```

---

## Suite 11 — Navegación y Permisos de Rutas (NUEVO — Iter. 2)

### T11.01 — Anónimo no accede a /admin
```
Navegar a /admin sin sesión
Esperado: redirección a /login o 403
```

### T11.02 — Monitor no accede a /admin
```
Navegar a /admin con sesión de Monitor A
Esperado: redirección o 403
```

### T11.03 — Monitor no accede a /configuracion
```
Navegar a /configuracion con sesión de Monitor A
Esperado: redirección o 403
```

### T11.04 — Monitor no accede a /monitor (gestión de monitores)
```
Navegar a /monitor con sesión de Monitor A
Esperado: redirección o 403
```

### T11.05 — Admin accede a /panel-monitor
```
Navegar a /panel-monitor con sesión de admin
Esperado: 200 · vista de panel de monitor
```

### T11.06 — /login con sesión activa redirige al panel
```
Navegar a /login con JWT válido de admin
Esperado: redirección a /admin
Navegar a /login con JWT válido de Monitor A
Esperado: redirección a /panel-monitor
```

### T11.07 — Orden de ítems en navbar
```
Renderizar navbar con sesión de admin
Esperado: Inicio · Eventos · Contacto · Panel de Administrador · Monitor · Panel de Monitor · Usuarios · Configuración
(sin "Inicio de Sesión" cuando hay sesión activa)
```

### T11.08 — Navbar anónimo
```
Renderizar navbar sin sesión
Esperado: Inicio · Eventos · Contacto · Inicio de Sesión
(sin ítems de admin ni monitor)
```

---

## Suite 12 — Configuración (NUEVO — Iter. 2)

### T12.01 — Leer configuración
```
GET /api/admin/configuracion  [Auth: admin]
Esperado: array con todas las claves del seed
```

### T12.02 — Actualizar nombre de la app
```
PUT /api/admin/configuracion  [Auth: admin]  [{ clave: "app_nombre", valor: "Mi Parroquia" }]
Reload de la app
Esperado: el nombre "Mi Parroquia" aparece en el título y navbar
```

### T12.03 — Actualizar color primario
```
PUT /api/admin/configuracion  [{ clave: "color_primario", valor: "#dc2626" }]
Reload
Esperado: --color-primario: #dc2626 en :root del CSS
```

### T12.04 — Valor de color inválido rechazado
```
PUT /api/admin/configuracion  [{ clave: "color_primario", valor: "javascript:alert(1)" }]
Esperado: 400 · valor no guardado
```

### T12.05 — Clave no existente rechazada (whitelist)
```
PUT /api/admin/configuracion  [{ clave: "clave_inventada", valor: "hack" }]
Esperado: 400 · clave no reconocida
```

### T12.06 — Monitor no puede acceder a configuración
```
GET /api/admin/configuracion  [Auth: Monitor A]
Esperado: 403
```

---

## Suite 13 — Formulario de Contacto (NUEVO — Iter. 2)

### T13.01 — Envío correcto
```
POST /api/public/contacto  { nombre: "Ana", email: "ana@test.com", asunto: "Consulta", mensaje: "Hola" }
Esperado: 200 { ok: true }  (sin autenticación)
```

### T13.02 — Campos obligatorios
```
POST /api/public/contacto  { nombre: "Ana" }
Esperado: 400 con campos faltantes indicados
```

### T13.03 — Email inválido
```
POST /api/public/contacto  { email: "no-es-email", ... }
Esperado: 400 "email no válido"
```

### T13.04 — Rate limiting en contacto
```
POST /api/public/contacto ×6 seguidas desde misma IP
Esperado en intento 6: 429
```

### T13.05 — El endpoint no expone si el email existe en el sistema
```
POST /api/public/contacto con email de admin válido
POST /api/public/contacto con email inventado
Esperado: ambos responden 200 { ok: true } (sin diferencia)
```

---

## Checklist de Ejecución

```
Fecha: ___________
Entorno: [ ] Local  [ ] Staging  [ ] Producción
Ejecutado por: ___________

[ ] Suite 1  — Autenticación          (10 tests)
[ ] Suite 2  — Control de Acceso       (6 tests)
[ ] Suite 3  — Registro del Joven     (10 tests)
[ ] Suite 4  — Ficha Personal          (6 tests)
[ ] Suite 5  — Panel Monitor          (10 tests)
[ ] Suite 6  — Panel Admin            (10 tests)
[ ] Suite 7  — Seguridad               (8 tests)
[ ] Suite 8  — Coste Cero              (2 tests)
[ ] Suite 9  — Notificaciones          (2 tests)  ⚠️ SKIP si no hay SMTP
[ ] Suite 10 — CORS y Errores          (8 tests)  🚨 BLOQUEA despliegue si FAIL
[ ] Suite 11 — Navegación y Rutas      (8 tests)
[ ] Suite 12 — Configuración           (6 tests)
[ ] Suite 13 — Formulario Contacto     (5 tests)

Total: 91 tests
PASS: ___  FAIL: ___  SKIP: ___

🚨 FAIL en Suite 7 o Suite 10 → DETENER DESPLIEGUE
⚠️  FAIL en Suites 1-6 con más de 2 → DETENER MERGE
```

---

## Scripts de Smoke Existentes

```bash
npm run smoke:api     # regresión admin + eventos + asignaciones monitor↔evento
npm run smoke:youth   # flujo registro joven + ficha + documentos + vistas monitor/admin
npm run smoke:roles   # validación de permisos por rol
```

> Las Suites 10-13 no tienen script de smoke automatizado aún. Ejecutar manualmente hasta que se implemente `smoke:nav-errors`.
