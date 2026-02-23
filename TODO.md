# TODO — Roadmap de Reiteración (base MD/V2)

## Objetivo

Reorientar el repositorio para converger con Iteración 2 (`MD/V2/*`) sin romper lo ya estable en v1.3.x.

---

## Fase 0 — Ya implementado en código

- [x] Admin: CRUD de eventos.
- [x] Admin: CRUD de usuarios + asignación monitor↔evento.
- [x] Admin: CRUD de jóvenes + perfil detallado.
- [x] Monitor: ver eventos activos asignados.
- [x] Monitor: ver/editar jóvenes asignados.
- [x] Monitor: validar documentos y gestionar pagos.
- [x] Auth: actualización de perfil, email y contraseña.
- [x] Registro/Ficha: enlace personal + edición + documentos.
- [x] Smoke tests: `smoke:api`, `smoke:youth`, `smoke:roles`.

---

## Fase 1 — Base backend Iteración 2 (prioridad alta)

- [x] Crear tabla `configuracion` + seed por defecto (según `MD/V2/SKILL.md`).
- [x] Endpoint `GET /api/admin/configuracion`.
- [x] Endpoint `PUT /api/admin/configuracion` con whitelist de claves.
- [x] Crear tabla `monitor_ficheros`.
- [ ] Endpoints monitor ficheros:
  - [x] `GET /api/monitor/ficheros`
  - [x] `POST /api/monitor/ficheros`
  - [x] `DELETE /api/monitor/ficheros/:ficheroId`
- [ ] Endpoint admin para ficheros de monitor:
  - [x] `GET /api/admin/monitores/:monitorId/ficheros`
- [ ] Endpoint dashboard global admin:
  - [x] `GET /api/admin/dashboard`
- [ ] Endpoint mini-dashboard por monitor:
  - [x] `GET /api/admin/monitores/:monitorId/dashboard`
- [ ] Endpoint público de contacto:
  - [x] `POST /api/public/contacto` con rate limiting y validación.

---

## Fase 2 — UX/Navegación Iteración 2 (prioridad alta)

- [x] Navbar completa por rol y orden de Iteración 2.
- [x] Página `/contacto` funcional.
- [x] Página `/configuracion` (solo admin).
- [x] Página `/panel-monitor` alineada al nuevo flujo.
- [ ] Ajuste de `/monitor` para que sea gestión de monitores (solo admin).
  - [ ] **Pospuesto intencionalmente**: se tomará acción en un bloque posterior dedicado para no mezclar con cierre de `eventos`/`usuarios`.
- [x] `/usuarios` con filtros expandibles y contexto por rol.
- [x] `/eventos` con filtros avanzados + vista tabla/cards.
- [x] `Layout.astro` con variables de color/nombre/logo desde `configuracion`.

---

## Fase 3 — Manejo de errores y CORS (prioridad crítica)

- [ ] Middleware CORS estricto por `FRONTEND_URL` con rechazo explícito.
- [ ] Cabecera `X-Error-Reason: cors-rejected` en rechazos CORS.
- [ ] Logging de origen/IP en rechazos CORS.
- [ ] Política unificada de errores backend `{ error: { code, message } }`.
- [ ] Frontend: `try/catch` en todos los fetch con feedback visual obligatorio.
- [ ] Componente global de notificación (`Toast`/`Banner`).

---

## Fase 4 — Validación de calidad (obligatoria antes de merge)

- [ ] Mantener en verde:
  - [x] `npm run smoke:api`
  - [x] `npm run smoke:youth`
  - [x] `npm run smoke:roles`
- [ ] Añadir smoke para nav/errores/CORS (`smoke:nav-errors`).
- [ ] Ejecutar suites manuales 10-13 de `MD/V2/TESTING.md`.
- [ ] Actualizar `CHANGELOG.md` por cada bloque de entrega.

---

## Matriz de acceso por rol (estado objetivo Iteración 2)

- **Anónimo**
  - [x] `/`
  - [x] `/eventos` (solo lectura pública)
  - [x] `/contacto`
  - [x] `/login`
- **Monitor**
  - [x] `/`
  - [x] `/eventos` (solo sus eventos asignados)
  - [x] `/contacto`
  - [x] `/panel-monitor`
  - [x] `/usuarios` (solo sus jóvenes)
  - [ ] `/monitor` (no debe ser su panel; pendiente separación final)
- **Admin (organizador/administrador)**
  - [x] `/`
  - [x] `/eventos` (CRUD + filtros)
  - [x] `/contacto`
  - [x] `/admin`
  - [x] `/panel-monitor`
  - [x] `/usuarios`
  - [x] `/configuracion`
  - [ ] `/monitor` (pendiente cierre definitivo como gestión de monitores)

---

## Decisión de implementación

Para minimizar riesgo, implementar por PRs cortos:
1. Backend base (configuración + contacto + ficheros + dashboards).
2. Navegación y páginas nuevas.
3. CORS/errores y validaciones de seguridad.
4. Testeo y endurecimiento final.

---

## Referencias

- `MD/V2/INSTRUCTIONS.md`
- `MD/V2/AGENT.md`
- `MD/V2/AGENT_SECURITY.md`
- `MD/V2/SKILL.md`
- `MD/V2/TESTING.md`
