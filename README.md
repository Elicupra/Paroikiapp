# Paroikiapp

Sistema de registro y gestión de eventos juveniles (campamentos, peregrinaciones, viajes) con backend Express + PostgreSQL y frontend Astro.

## Reiteración del repositorio (base V2)

Este repositorio se alinea con la documentación de Iteración 2 en `MD/V2/`:
- `MD/V2/INSTRUCTIONS.md`
- `MD/V2/AGENT.md`
- `MD/V2/AGENT_SECURITY.md`
- `MD/V2/SKILL.md`
- `MD/V2/TESTING.md`
- `MD/V2/CHANGELOG.md`

## Estado actual (implementado en código)

### Administrador (`organizador` / `administrador`)
- Gestión de eventos: crear, listar, editar y desactivar.
- Gestión de usuarios: crear monitor, editar usuario, activar/desactivar y eliminar.
- Gestión de asignaciones monitor↔evento: crear, modificar, revocar enlace y eliminar.
- Gestión de jóvenes: listar, crear, editar, eliminar y ver perfil completo (pagos + documentos).
- Recaudación por evento y por monitor.

### Monitor
- Visualiza sus eventos activos asignados.
- Visualiza solo jóvenes vinculados a sus asignaciones.
- Edita jóvenes asignados.
- Valida documentos de sus jóvenes.
- Registra/actualiza pagos.
- Gestiona su perfil (nombre mostrado, email y contraseña).

### Registro público y ficha
- Registro por enlace de monitor.
- Entrega de enlace personal de ficha (`/ficha/:token`) tras registro.
- Edición de ficha y gestión de documentos desde el enlace personal.

## Gap con Iteración 2 (pendiente)

Pendiente principal para completar lo definido en `MD/V2`:
- Sección pública `Contacto` con endpoint `POST /api/public/contacto`.
- Configuración dinámica (`/api/admin/configuracion`) + tabla `configuracion` usada por layout/tema.
- Dashboard global admin (`/api/admin/dashboard`) y mini-dashboard por monitor.
- Ficheros privados de monitor (`monitor_ficheros` + endpoints monitor/admin).
- Navbar y estructura de rutas final Iteración 2 (`/panel-monitor`, `/configuracion`, etc.).
- Suites manuales 10-13 de `MD/V2/TESTING.md` (CORS/errores/navegación/config/contacto).

## Stack
- Backend: Node.js + Express + PostgreSQL
- Frontend: Astro (SSR)
- Proxy: Nginx
- Auth: JWT + refresh tokens

## Inicio rápido (Docker)

### 1) Configurar entorno
Crear `backend/.env`:

```bash
DATABASE_URL=postgresql://camposter:camposter123@postgres:5432/campregister
DB_SCHEMA=paroikiapp
JWT_SECRET=<clave-segura-larga>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
FRONTEND_URL=http://localhost
NODE_ENV=production
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=secret
NOTIFY_FROM="Paroikiapp <no-reply@example.com>"
```

### 2) Levantar servicios
```bash
docker-compose up --build
```

### 3) Migrar y seed
```bash
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed
```

## Desarrollo local

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testing

Ejecutar desde raíz:

```bash
npm run smoke:api
npm run smoke:youth
npm run smoke:roles
```

Cobertura actual:
- `smoke:api`: regresión admin/eventos/asignaciones.
- `smoke:youth`: flujo joven/ficha/documentos.
- `smoke:roles`: verificación de requisitos por rol (admin y monitor).

Para pruebas de Iteración 2 completas usar `MD/V2/TESTING.md` (suites 1-13).

## Seguridad

Aplicado en base actual:
- Hash de contraseñas con bcrypt.
- Control de acceso por rol en backend.
- Prepared statements.
- Validación de tipo real de archivos.
- Rate limiting en endpoints sensibles.
- Helmet + CORS.

Checklist ampliado de Iteración 2: `MD/V2/AGENT_SECURITY.md`.

## API principal (resumen actual)

### Auth
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `PATCH /api/auth/me/profile`
- `PATCH /api/auth/me/email`
- `PATCH /api/auth/me/password`

### Admin
- Eventos: `GET/POST/PUT/DELETE /api/admin/eventos` + recaudación/descuento.
- Usuarios: `GET/POST/PUT/PATCH/DELETE /api/admin/usuarios`.
- Asignaciones monitor-evento: alta/baja/edición/revocación.
- Jóvenes: `GET/POST/PATCH/DELETE /api/admin/jovenes` + perfil.

### Monitor
- `GET /api/monitor/eventos`
- `GET /api/monitor/eventos/:eventoId/recaudacion`
- `GET /api/monitor/resumen?evento_id=:id`
- `GET /api/monitor/registration-link`
- `GET /api/monitor/jovenes`
- `GET /api/monitor/jovenes/:jovenId`
- `PATCH /api/monitor/jovenes/:jovenId`
- `GET /api/monitor/jovenes/:jovenId/documentos`
- `PATCH /api/monitor/documentos/:docId/validar`
- `POST /api/monitor/pagos`
- `PATCH /api/monitor/pagos/:pagoId`

### Registro/Ficha
- `GET /register/:token`
- `POST /register/:token/joven`
- `POST /register/:token/joven/:jovenId/documento`
- `GET /register/acceso/:accessToken`
- `POST /register/acceso/:accessToken/documento`
- `GET /ficha/:jovenToken`
- `PATCH /ficha/:jovenToken`
- `POST /ficha/:jovenToken/documento`
- `DELETE /ficha/:jovenToken/documento/:docId`

## Documentación relacionada
- `README.md` (este documento)
- `TODO.md` (plan de implementación por fases)
- `CHANGELOG.md` (cambios aplicados)
- `MD/V2/*` (objetivo Iteración 2 y criterios completos)
