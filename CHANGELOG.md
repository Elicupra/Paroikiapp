# CHANGELOG

## [1.3.9] - 2026-02-23

### Agregado
- Nuevas páginas frontend de Iteración 2:
	- `frontend/src/pages/contacto.astro`
	- `frontend/src/pages/configuracion.astro`
	- `frontend/src/pages/panel-monitor.astro`
- Endpoint público para consumo de configuración en frontend:
	- `GET /api/public/configuracion`

### Modificado
- `frontend/src/components/Navbar.astro` actualiza navegación por rol y orden alineado a Iteración 2.
- `frontend/src/layouts/Layout.astro` integra nombre y colores dinámicos desde configuración pública.
- `backend/src/controllers/publicController.js` y `backend/src/routes/public.js` exponen configuración pública para layout/tema.
- `frontend/src/pages/usuarios.astro` pasa a buscador de jóvenes con filtros expandibles y contexto por rol (admin/monitor).
- `frontend/src/pages/eventos.astro` añade filtros avanzados (tipo/fechas/texto/orden) y conmutador de vista tabla/cards, con carga por rol.
- `frontend/src/pages/eventos.astro` corrige carga por contexto de acceso (anónimo/admin/monitor), renombra la vista principal a **Eventos Próximos** y mantiene el estado `activo` como criterio funcional.
- `frontend/src/pages/eventos.astro` corrige bloqueo de UI con parsing seguro de sesión y timeout de carga para evitar estado infinito de "Cargando eventos...".
- `frontend/src/pages/eventos.astro` recupera pestaña **Eventos Pasados** (admin) y asegura funcionamiento del botón **+ Nuevo Evento** en contexto administrador.
- `frontend/src/pages/eventos.astro` reescrito con flujo simplificado y estable:
	- pestañas funcionales de **Eventos Próximos** y **Eventos Pasados**,
	- listado de eventos futuros con acciones **Modificar** y **Borrar** por evento,
	- creación/edición/borrado operativo para admin,
	- fallback de error visible si la API no responde.
- `frontend/src/components/Navbar.astro` aclara diferencias de navegación: **Monitor (Gestión)** (admin) vs **Panel de Monitor** (admin/monitor).
- `TODO.md` deja explícito que el ajuste final de `/monitor` queda pospuesto para un bloque posterior dedicado.

### Validación
- Build frontend en verde tras cambios:
	- `cd frontend && npm run build`

## [1.3.8] - 2026-02-23

### Agregado
- Endpoints admin de Iteración 2 para configuración y dashboard:
	- `GET/PUT /api/admin/configuracion`
	- `GET /api/admin/dashboard`
	- `GET /api/admin/monitores/:monitorId/dashboard`
- Endpoints de ficheros privados de monitor:
	- `GET/POST/DELETE /api/monitor/ficheros`
	- `GET /api/admin/monitores/:monitorId/ficheros`
- Endpoint público de contacto con rate limiting dedicado:
	- `POST /api/public/contacto`

### Modificado
- Bootstrap de esquema avanzado (`advancedSchema`) ampliado con tablas `configuracion` y `monitor_ficheros` + seed inicial de claves de configuración.
- `seed.js` ahora asegura la tabla `configuracion` y sus valores por defecto.
- `upload.js` incorpora middleware dedicado `uploadMonitorFichero` para almacenamiento privado por monitor.
- `monitorController.getJovenes` se mantiene compatible y sin regresiones tras validación de suites existentes.

### Validación
- Suites smoke en verde tras cambios:
	- `npm run smoke:api`
	- `npm run smoke:youth`
	- `npm run smoke:roles`
- Comprobación rápida de endpoints nuevos: `configuracion`, `dashboard`, `monitor ficheros` y `contacto` devolviendo `200`.

## [1.3.7] - 2026-02-20

### Corregido
- `eventos.astro`: acciones dinámicas (`Editar`, `Descuento`, `Desactivar`) migradas a delegación por `data-*` para evitar errores de parseo en navegador como `Unexpected token ':'`.
- `admin.astro`: acceso reforzado a gestión de eventos/usuarios con enlaces directos a `/eventos` y `/usuarios`, y carga de recaudación por evento con fallback seguro.
- `usuarios.astro`: acciones de asignación de eventos migradas a delegación de eventos y renderizado escapado para evitar errores por interpolación.
- `monitor.astro` y `admin.astro`: habilitada visualización de perfil completo de joven (documentos y pagos) desde panel de gestión.

### Modificado
- `registerController.js`: el enlace personal de acceso del joven pasa a usar `/ficha/:token`.
- `register.astro`: flujo de alta mejorado para mostrar y copiar enlace personal, evitando redirección inmediata y permitiendo subida opcional de documentos al finalizar registro.
- `upload.js`: filtro inicial ampliado para aceptar `text/plain` y `application/octet-stream`, manteniendo validación de tipo real posterior.

### Agregado
- Nueva página de ficha personal: `frontend/src/pages/ficha/[token].astro` con lectura, edición y gestión de documentos por token.
- Endpoint admin para perfil de joven: `GET /api/admin/jovenes/:jovenId/perfil`.
- Smoke test de regresión de flujo joven/ficha/documentos/perfiles en `test/smoke-youth-flow.js`.

### Requisitos
- Backend admin amplía gestión de jóvenes con operaciones directas: `POST/PATCH/DELETE /api/admin/jovenes`.
- Backend monitor permite edición básica de jóvenes asignados: `PATCH /api/monitor/jovenes/:jovenId`.
- Backend auth amplía perfil propio: `PATCH /api/auth/me/profile` (nombre mostrado), junto a rutas existentes de correo y contraseña.
- `monitorController.getJovenes` corrige listado para incluir jóvenes de todas las asignaciones/eventos activos del monitor.
- `monitor.astro` incorpora navegación/operaciones de perfil del monitor (nombre, correo, credenciales) y edición rápida de joven en modal.
- Nueva suite de verificación por rol en `test/smoke-role-requirements.js` y script `npm run smoke:roles`.

## [1.3.6] - 2026-02-20

### Agregado
- Workflow CI `Smoke API` en `.github/workflows/smoke-api.yml` ejecutado en `push` y `pull_request`.
- El pipeline levanta PostgreSQL de servicio, prepara schema/`pgcrypto`, ejecuta `migrate` + `seed` y corre `npm run smoke:api`.

## [1.3.5] - 2026-02-20

### Modificado
- `smoke-admin-assignments.js` ampliado para cubrir ciclo completo de asignación monitor↔evento: crear evento temporal, asignar, actualizar por evento, revocar enlace, eliminar asignación por evento y verificar que desaparece del listado.

## [1.3.4] - 2026-02-20

### Agregado
- Suite smoke de API para regresión en endpoints críticos de admin/eventos y asignación monitor↔evento: `test/smoke-admin-assignments.js`.
- Runner dedicado para ejecutar smoke con backend reutilizado o autoarrancado: `test/run-smoke-api.js`.
- Scripts raíz: `npm run smoke:api` y `npm run smoke:api:only`.

## [1.3.3] - 2026-02-20

### Corregido
- `admin.astro`: carga de eventos endurecida para evitar bloqueos en "Cargando" al consultar recaudación por evento (timeouts y `Promise.allSettled`).
- `usuarios.astro`: migrado a `PUBLIC_API_URL` para que la asignación de monitores a eventos funcione en entornos no-localhost.

## [1.3.2] - 2026-02-20

### Modificado
- `admin.astro` usa `PUBLIC_API_URL` en lugar de URL hardcodeada para compatibilidad por entorno.
- Se integra recaudación por evento consumiendo `GET /api/admin/eventos/:eventoId/recaudacion` con fallback al agregado legado del listado.
- Enlaces de registro muestran `max_jovenes` cuando está disponible.

### Seguridad
- Escape de contenido dinámico en tablas/listados del panel admin para reducir riesgo de XSS.

## [1.3.1] - 2026-02-20

### Modificado
- `monitor.astro` conectado a `GET /api/monitor/eventos` y `GET /api/monitor/eventos/:eventoId/recaudacion` con fallback automático a endpoints legacy.
- `monitor.astro` usa `PUBLIC_API_URL` en lugar de URL hardcodeada para mantener compatibilidad por entorno.

## [1.3.0] - 2026-02-20

### Agregado
- Endpoints de monitor para eventos y recaudación: `GET /api/monitor/eventos` y `GET /api/monitor/eventos/:eventoId/recaudacion`.
- Endpoint admin de recaudación por evento: `GET /api/admin/eventos/:eventoId/recaudacion`.

### Modificado
- Cálculo de recaudación y eventos asignados usa `asignacion_eventos` cuando existe y mantiene fallback al modelo legado.

## [1.2.0] - 2026-02-20

### Agregado
- Compatibilidad progresiva para `asignacion_eventos` con creación y sincronización automática desde `monitores`.
- Endpoints admin de asignación estilo Iteración 1: `GET/POST/PATCH/DELETE /api/admin/monitores/:monitorId/eventos`, revocación de enlace por evento y `PATCH /max-jovenes`.

### Modificado
- Registro público por token ahora admite resolución desde `asignacion_eventos.enlace_token` y aplica `max_jovenes` por monitor+evento cuando está definido.
- Resumen del monitor usa `max_jovenes` de asignación cuando existe (fallback seguro a 10).

## [1.1.1] - 2026-02-20

### Modificado
- Flujo de eventos con compatibilidad progresiva para `tipo_evento_id` sin romper el campo legado `tipo`.
- `eventos.astro` consume catálogo `tipos-evento` para construir el selector y enviar `tipo_evento_id` cuando existe.

### Corregido
- Listado/detalle de eventos devuelve preferencia de nombre de tipo desde catálogo (`tipo_evento_nombre`) cuando está disponible.

## [1.1.0] - 2026-02-20

### Agregado
- Endpoints de compatibilidad para ficha personal por token: `GET/PATCH /ficha/:jovenToken`, `POST/DELETE /ficha/:jovenToken/documento`.
- Endpoints administrativos base para tipos de evento: `GET/POST/PATCH/DELETE /api/admin/tipos-evento`.

### Modificado
- Compatibilidad de rol de administración en backend y frontend para aceptar `organizador` y `administrador` en navegación/autorización.
- Bootstrap de esquema avanzado ampliado para crear y sembrar `tipos_evento` automáticamente si no existe.

## [1.0.1] - 2026-02-20

### Corregido
- Frontend de eventos usa `PUBLIC_API_URL` en lugar de URL hardcodeada para evitar entornos rotos por configuración fija.
- Renderizado de tarjetas en `eventos.astro` con escape de contenido para reducir riesgo de XSS en campos de evento.

### Seguridad
- Subida de documentos endurecida: nombre de archivo aleatorio UUID y validación de tipo real con `file-type`.
- Almacenamiento de documentos con MIME detectado realmente cuando está disponible.
- Descarga de documentos protegida contra path traversal validando que la ruta resuelta queda dentro de `UPLOADS_PATH`.

## [1.0.0] - 2026-02-19

### Agregado
- Estructura base del proyecto (Backend Express + Frontend Astro)
- Autenticación segura con JWT y refresh tokens
- Base de datos PostgreSQL con schema completo
- Sistema de registro público de participantes
- Panel de monitor para gestión de jóvenes y pagos
- Panel de administrador para eventos y usuarios
- Validación y sanitización de inputs
- Rate limiting en endpoints públicos
- Hashing seguro de contraseñas con bcrypt
- Notificaciones por email
- Soporte para subida de documentos
- Nginx como proxy reverso
- Docker Compose para despliegue
- Headers de seguridad HTTP (helmet)
- CORS configurado y restrictivo
- Logs de seguridad

### Seguridad
- ✅ Prepared statements en todas las queries
- ✅ Validación MIME type real de archivos
- ✅ Almacenamiento de archivos fuera del webroot
- ✅ Refresh tokens con validación en BD
- ✅ No exposición de datos sensibles en errores
- ✅ UUIDs generados con crypto.randomUUID()
- ✅ Límites de tamaño de request (5MB)
- ✅ Rate limiting específico para login (5 intentos/15 min)

### Documentación
- README.md con instrucciones de inicio
- AGENT.md - Guía de desarrollo
- AGENT_SECURITY.md - Checklist de seguridad
- SKILL.md - Esquema de BD y contratos API

### Known Issues & TODO
- [ ] Sistema de backup automático de BD
- [ ] Webhooks para monitores externos
- [ ] Dashboard avanzado con gráficas
- [ ] API de reportes
- [ ] Sistema de descuentos automáticos
- [ ] Integración con pasarela de pagos (educativo, sin procesamiento real)
- [ ] Tests funcionales E2E
- [ ] Certificados SSL/TLS para producción
- [ ] Fail2ban para bloqueo de IPs agresivas
