# CHANGELOG — Paroikiapp

> Este fichero es la fuente de verdad para el control de versiones de la documentación y del proyecto.
> Un agente que lea este fichero debe ser capaz de entender qué ha cambiado, en qué ficheros y por qué,
> antes de realizar cualquier modificación.

---

## Instrucciones para el Agente

Antes de modificar cualquier fichero de documentación o código, el agente debe:

1. Leer este CHANGELOG completo para entender el estado actual
2. Identificar la última versión registrada
3. Al finalizar sus cambios, añadir una nueva entrada siguiendo el formato definido abajo
4. Nunca sobrescribir entradas anteriores; solo añadir al principio de la sección de versiones
5. Si un cambio afecta a la BD (esquema), marcarlo con `[BREAKING]` si rompe compatibilidad

### Formato de entrada

```
## [X.Y.Z] — YYYY-MM-DD

### Tipo de cambio
- Descripción concisa del cambio
- Fichero(s) afectado(s): `FICHERO.md`, `ruta/al/archivo.js`
- Motivo: por qué se hizo este cambio
```

### Tipos de cambio válidos

| Tipo | Cuándo usarlo |
|---|---|
| `Añadido` | Nueva funcionalidad, nuevo fichero, nueva tabla |
| `Modificado` | Cambio en funcionalidad existente |
| `Eliminado` | Funcionalidad o fichero eliminado |
| `Corregido` | Bug fix o corrección de documentación |
| `Seguridad` | Cambio motivado por seguridad |
| `Deprecado` | Funcionalidad que se eliminará en el futuro |
| `[BREAKING]` | Cambio que rompe compatibilidad (BD, API, contratos) |

---

## Versiones

## [0.2.0] — 2026-02-20

### Añadido
- Nuevo fichero `INSTRUCTIONS.md` con historial completo de requerimientos (Iteración 0 e Iteración 1)
  - Fichero: `INSTRUCTIONS.md`
  - Motivo: centralizar el contexto de requerimientos para que los agentes tengan fuente de verdad única

- Nuevo fichero `CHANGELOG.md` (este fichero)
  - Fichero: `CHANGELOG.md`
  - Motivo: control de versiones de documentación y código legible por agentes

- Nuevo fichero `TESTING.md` con plan completo de pruebas por funcionalidad
  - Fichero: `TESTING.md`
  - Motivo: permitir que un agente ejecute pruebas automatizadas o manuales sobre las funcionalidades implementadas

### Modificado
- `AGENT.md` — Iteración 0 → Iteración 1
  - Añadidos: tabla de roles completa (Admin, Monitor, Joven, Anónimo)
  - Añadido: tabla de navbar con visibilidad por rol
  - Añadido: flujo detallado del enlace personal del joven
  - Añadido: lógica de eventos con coste 0
  - Añadido: mapa de componentes Astro (Navbar, JovenRow, DocumentUpload, PagoForm)
  - Añadido: mapa de rutas del frontend por rol
  - Motivo: Iteración 1 de requerimientos

- `AGENT_SECURITY.md` — Iteración 0 → Iteración 1
  - Añadido: checklist para el token personal del joven
  - Añadido: vectores de ataque específicos (token de monitor expuesto, enumeración de jóvenes, escalada de rol)
  - Añadido: regla de no-enumeración en `/ficha/:token` (404 idéntico para token inválido y sin datos)
  - Modificado: checklist de autenticación — añadido que `nombre_mostrado` no es modificable por el usuario
  - Motivo: nuevas superficies de ataque introducidas en Iteración 1

- `SKILL.md` — Iteración 0 → Iteración 1
  - `[BREAKING]` Añadida tabla `tipos_evento` con seed obligatorio (Campamento, Peregrinación, Viaje)
  - `[BREAKING]` Añadida tabla `asignacion_eventos` (reemplaza relación directa monitor↔evento)
  - `[BREAKING]` Añadida tabla `refresh_tokens` (antes los tokens no se persistían)
  - `[BREAKING]` Añadido campo `enlace_token` en tabla `jovenes` (token personal único)
  - `[BREAKING]` Añadidos campos `coste_cero`, `descuento_global`, `visible_publico`, `tipo_evento_id` en tabla `eventos`
  - Añadido campo `max_jovenes` en `asignacion_eventos`
  - Añadidos endpoints: `/ficha/:joven_token`, `/api/admin/tipos-evento`, `/api/admin/monitores/:id/eventos`, recaudación
  - Añadida lógica de negocio: precio efectivo, recaudación por monitor (query SQL), límite de jóvenes
  - Motivo: Iteración 1 de requerimientos

---

## [0.1.0] — 2026-02-19

### Añadido
- Creación inicial del repositorio `Paroikiapp`
- `AGENT.md` — agente general de desarrollo (Iteración 0)
  - Stack definido: Node.js + Express + PostgreSQL + Astro + Nginx
  - Roles iniciales: monitor y organizador
  - Flujo de enlace de monitor por evento
  - Restricciones absolutas de desarrollo

- `AGENT_SECURITY.md` — agente de seguridad (Iteración 0)
  - Checklist inicial: auth, SQL injection, subida de archivos, red, secretos
  - Protocolo de respuesta ante incidentes

- `SKILL.md` — esquema BD y contratos API (Iteración 0)
  - Tablas: `eventos`, `usuarios`, `monitores`, `jovenes`, `documentos`, `pagos`
  - Contratos de API: auth, registro público, monitor, admin, documentos
  - Sistema de notificaciones por email con Nodemailer
  - Webhook saliente opcional con firma HMAC-SHA256

- `docker-compose.yml` — orquestación de servicios (backend, frontend, postgres, nginx)
- `Makefile` — comandos de desarrollo automatizados
- `README.md` — documentación de usuario y despliegue
- `ARCHITECTURE.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`, `QUICKSTART.md`
- Estructura de carpetas: `backend/`, `frontend/`, `nginx/`, `fail2ban/`, `test/`

---

## Tabla de Estado Actual de Ficheros

| Fichero | Versión | Última modificación | Estado |
|---|---|---|---|
| `INSTRUCTIONS.md` | 1.0 | 2026-02-20 | ✅ Actualizado |
| `AGENT.md` | 1.1 | 2026-02-20 | ✅ Actualizado |
| `AGENT_SECURITY.md` | 1.1 | 2026-02-20 | ✅ Actualizado |
| `SKILL.md` | 1.1 | 2026-02-20 | ✅ Actualizado |
| `CHANGELOG.md` | 1.0 | 2026-02-20 | ✅ Nuevo |
| `TESTING.md` | 1.0 | 2026-02-20 | ✅ Nuevo |
| `docker-compose.yml` | 1.0 | 2026-02-19 | Sin cambios |
| `README.md` | 1.0 | 2026-02-19 | Pendiente actualizar con Iter. 1 |
| `TODO.md` | — | 2026-02-19 | Pendiente revisar con Iter. 1 |
