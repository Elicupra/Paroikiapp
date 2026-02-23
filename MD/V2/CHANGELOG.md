# CHANGELOG — Paroikiapp

> Fuente de verdad de cambios en documentación y código.
> Un agente debe leer este fichero completo antes de modificar cualquier otro.
> Añadir siempre al principio de la sección de versiones. Nunca sobrescribir entradas anteriores.

---

## Instrucciones para el Agente

1. Leer este fichero completo → entender versión actual
2. Al finalizar cambios → añadir nueva entrada **al principio** de las versiones
3. Marcar con `[BREAKING]` si el cambio rompe compatibilidad de BD, API o contratos
4. Tipos válidos: `Añadido`, `Modificado`, `Eliminado`, `Corregido`, `Seguridad`, `Deprecado`
5. Incluir siempre: ficheros afectados y motivo del cambio

---

## Versiones

---

## [2.0.0] — 2026-02-23 (Iteración 2 — Diseño, pendiente implementación)

### Añadido — Documentación
- `INSTRUCTIONS.md`: Iteración 2 documentada con nueva estructura de navegación, política de errores, nuevas entidades de BD y ficheros frontend nuevos/modificados
- `AGENT.md`: módulos backend y frontend actualizados, política de gestión de errores, tabla de navegación por rol completa
- `AGENT_SECURITY.md`: checklist CORS, validación de configuración editable, vector "formulario de contacto", respuesta ante error CORS en producción
- `SKILL.md`: tablas `configuracion` y `monitor_ficheros`, endpoints nuevos (dashboard, configuración, contacto, ficheros monitor, mini-dashboard de monitor)
- `TESTING.md`: suites 10-13 añadidas (navegación, configuración, contacto, CORS+errores)
- `CHANGELOG.md`: entrada [2.0.0] y formato revisado

### Añadido — Backend (a implementar)
- Tabla `configuracion` con seed de valores por defecto
- Tabla `monitor_ficheros` para ficheros privados del monitor
- Endpoint `GET/PUT /api/admin/configuracion`
- Endpoint `POST /api/public/contacto` con envío por email y rate limiting
- Endpoint `GET /api/admin/dashboard` (resumen global)
- Endpoint `GET /api/admin/monitores/:monitorId/dashboard` (mini-dashboard por monitor)
- Endpoint `GET/POST/DELETE /api/monitor/ficheros` (ficheros privados del monitor)
- Endpoint `GET /api/admin/monitores/:monitorId/ficheros` (admin ve ficheros de un monitor)
- Middleware `cors.js` refactorizado con whitelist desde `FRONTEND_URL`, log de rechazos, cabecera `X-Error-Reason`
- Handler global `errorHandler.js` con formato unificado `{ error: { code, message } }` y supresión de stack en producción

### Añadido — Frontend (a implementar)
- Página `/contacto` con formulario completo y toast de confirmación
- Página `/configuracion` (solo admin): secciones Parroquia, Apariencia, Contacto, Sistema
- Componente `Toast.astro`: sistema de notificaciones en pantalla (info/success/warning/error)
- Componente `Carrusel.astro`: carrusel de eventos para la página de inicio
- Componente `EventoCard.astro`: card reutilizable para carrusel y listados
- Componente `BuscadorFiltros.astro`: buscador expandible con filtros, reutilizable en `/usuarios` y `/eventos`
- Componente `ErrorBoundary.astro`: wrapper de gestión de errores para secciones con fetch
- Componente `ParroquiaInfo.astro`: bloque de texto de parroquia editable desde configuración
- Componente `DashboardCard.astro`: tarjeta clicable para dashboards de admin y monitor

### Modificado — Frontend (a implementar)
- `Navbar.astro`: nueva estructura con todos los ítems de Iteración 2, visibilidad por rol, orden correcto
- `index.astro`: carrusel de eventos + sección parroquia dinámica desde tabla `configuracion`
- `eventos/index.astro`: filtros expandibles, vista tabla/cards conmutable, permisos diferenciados por rol
- `admin/index.astro`: dashboard con tarjetas clicables que navegan a la sección correspondiente
- `monitor/index.astro`: lista de monitores como entidad (solo admin), mini-dashboard al hacer clic en monitor
- `panel-monitor/index.astro`: dashboard personal del monitor con gestión de grupos y perfil propio
- `usuarios/index.astro`: buscador con filtros expandibles, filtrado automático según contexto de navegación
- `login.astro`: campo para pegar enlace de ficha, redirección automática si hay sesión activa
- `Layout.astro`: inyección de variables CSS desde tabla `configuracion`, inclusión de `Toast.astro` global

### Añadido — Reglas de negocio
- Política unificada de gestión de errores frontend ↔ backend (ver `AGENT.md` y `INSTRUCTIONS.md`)
- Configuración dinámica de apariencia via tabla `configuracion` y CSS variables
- Validación whitelist de claves en `PUT /api/admin/configuracion`
- Rate limiting en formulario de contacto: máx. 5 envíos / hora por IP

---

## [0.2.0] — 2026-02-20

### Añadido
- `INSTRUCTIONS.md` — historial completo de requerimientos (Iteraciones 0 y 1)
- `CHANGELOG.md` — control de versiones de documentación legible por agentes
- `TESTING.md` — plan de pruebas completo (60 tests, 9 suites)

### Modificado
- `AGENT.md` Iter. 0 → Iter. 1: tabla de roles, navbar, flujo enlace personal del joven, lógica coste 0, mapa de componentes Astro
- `AGENT_SECURITY.md` Iter. 0 → Iter. 1: checklist para token personal del joven, vectores de ataque específicos
- `SKILL.md` Iter. 0 → Iter. 1:
  - `[BREAKING]` Tabla `tipos_evento` con seed obligatorio
  - `[BREAKING]` Tabla `asignacion_eventos` (reemplaza relación directa monitor↔evento)
  - `[BREAKING]` Tabla `refresh_tokens`
  - `[BREAKING]` Campo `enlace_token` en `jovenes`
  - `[BREAKING]` Campos `coste_cero`, `descuento_global`, `visible_publico`, `tipo_evento_id` en `eventos`

---

## [0.1.0] — 2026-02-19

### Añadido (versión inicial del repositorio)
- `AGENT.md`, `AGENT_SECURITY.md`, `SKILL.md` — documentación inicial (Iteración 0)
- Estructura de proyecto: `backend/`, `frontend/`, `nginx/`, `fail2ban/`, `test/`
- `docker-compose.yml`, `Makefile`, `README.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`, `QUICKSTART.md`
- Backend Express con auth JWT, rutas de admin/monitor/registro/ficha
- Frontend Astro con páginas de admin, monitor, registro, ficha
- PostgreSQL con schema completo y migraciones
- Smoke tests: `smoke-admin-assignments.js`, `smoke-youth-flow.js`, `smoke-role-requirements.js`
- CI GitHub Actions: `.github/workflows/smoke-api.yml`

---

## Tabla de Estado de Ficheros de Documentación

| Fichero | Versión | Última mod. | Estado |
|---|---|---|---|
| `INSTRUCTIONS.md` | 2.0 | 2026-02-23 | ✅ Actualizado |
| `AGENT.md` | 2.0 | 2026-02-23 | ✅ Actualizado |
| `AGENT_SECURITY.md` | 2.0 | 2026-02-23 | ✅ Actualizado |
| `SKILL.md` | 2.0 | 2026-02-23 | ✅ Actualizado |
| `CHANGELOG.md` | 2.0 | 2026-02-23 | ✅ Actualizado |
| `TESTING.md` | 2.0 | 2026-02-23 | ✅ Actualizado |
| `README.md` | 1.3.7 | 2026-02-20 | ⚠️ Pendiente actualizar con Iter. 2 |
| `TODO.md` | — | 2026-02-19 | ⚠️ Pendiente revisar con Iter. 2 |
| `docker-compose.yml` | 1.0 | 2026-02-19 | Sin cambios |
| `ARCHITECTURE.md` | 1.0 | 2026-02-19 | ⚠️ Pendiente actualizar con Iter. 2 |
