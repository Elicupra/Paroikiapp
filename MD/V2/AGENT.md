# AGENT — Paroikiapp

> Versión: Iteración 2
> Estado del código base: v1.3.7
> Referencia de requerimientos: `INSTRUCTIONS.md`
> Historial de cambios: `CHANGELOG.md`

## Propósito

Agente de desarrollo para Paroikiapp. Lee este fichero para entender la arquitectura, módulos y reglas antes de implementar cualquier cambio. Para el historial completo de requerimientos, ve a `INSTRUCTIONS.md`.

---

## Stack

| Capa | Tecnología | Notas |
|---|---|---|
| Backend | Node.js + Express | `backend/src/server.js` |
| Base de datos | PostgreSQL | Schema: `paroikiapp` |
| Frontend | Astro (SSR) | `frontend/src/` |
| Proxy | Nginx | `nginx/nginx.conf` |
| Contenedores | Docker Compose | `docker-compose.yml` |
| Auth | JWT (15 min) + refresh token httpOnly | |
| Email | Nodemailer + SMTP configurable | |
| Tests | Node scripts (smoke) | `test/` |
| CI | GitHub Actions | `.github/workflows/smoke-api.yml` |

---

## Roles y Permisos

| Rol | Creado por | Acceso |
|---|---|---|
| `administrador` / `organizador` | Seed inicial o admin existente | Total |
| `monitor` | Solo por admin | Solo eventos/jóvenes asignados |
| Joven (sin cuenta) | Auto-registro por enlace | Solo su ficha personal `/ficha/:token` |
| Anónimo | — | Inicio, Eventos (vista pública), Contacto, Login |

---

## Estructura de Navegación (Iteración 2)

Orden: **Inicio · Eventos · Contacto · Panel de Administrador · Monitor · Panel de Monitor · Usuarios · Inicio de Sesión · Configuración**

| Ítem | Ruta | Anónimo | Monitor | Admin |
|---|---|---|---|---|
| Inicio | `/` | ✅ | ✅ | ✅ |
| Eventos | `/eventos` | ✅ | ✅ | ✅ |
| Contacto | `/contacto` | ✅ | ✅ | ✅ |
| Panel de Administrador | `/admin` | ❌ | ❌ | ✅ |
| Monitor | `/monitor` | ❌ | ❌ | ✅ |
| Panel de Monitor | `/panel-monitor` | ❌ | ✅ | ✅ |
| Usuarios | `/usuarios` | ❌ | ✅* | ✅ |
| Inicio de Sesión | `/login` | ✅ | ❌** | ❌** |
| Configuración | `/configuracion` | ❌ | ❌ | ✅ |

> *Monitor: solo ve sus propios jóvenes
> **Si hay sesión activa, `/login` redirige al panel correspondiente

---

## Módulos Backend

### Rutas (`backend/src/routes/`)

| Fichero | Prefijo | Descripción |
|---|---|---|
| `auth.js` | `/api/auth` | login, refresh, logout, perfil, email, password |
| `admin.js` | `/api/admin` | eventos, usuarios, monitores, jóvenes, tipos-evento, recaudación, configuración, dashboard, ficheros de monitor |
| `monitor.js` | `/api/monitor` | eventos, recaudación, jóvenes, pagos, resumen, ficheros propios |
| `public.js` | `/api/public` | eventos visibles, formulario de contacto |
| `register.js` | `/register` | registro por token de monitor |
| `ficha.js` | `/ficha` | ficha personal del joven por su token |
| `documentos.js` | `/api/documentos` | descarga autenticada de documentos |

### Middleware (`backend/src/middleware/`)

| Fichero | Función |
|---|---|
| `auth.js` | Verifica JWT, extrae `{ id, rol }` |
| `roles.js` | Guards: `requireAdmin`, `requireMonitor`, `requireAdminOrMonitor` |
| `rateLimiter.js` | Rate limiting por IP; más estricto en `/api/auth/login` |
| `upload.js` | multer + validación MIME real (file-type) + rename UUID |
| `sanitize.js` | Validación y sanitización de inputs (zod/joi) |
| `cors.js` | CORS con `FRONTEND_URL` de `.env`; rechaza otros orígenes con 403 |
| `errorHandler.js` | Handler global de errores; formato `{ error: { code, message } }` |

### Servicios (`backend/src/services/`)

| Fichero | Función |
|---|---|
| `notifications.js` | Email al monitor cuando se registra un joven |
| `stats.js` | Cálculo de recaudación por evento/monitor |
| `mailer.js` | Envío de emails genérico (usado por notificaciones y contacto) |
| `config.js` | Lectura/escritura de tabla `configuracion` con caché en memoria |

---

## Módulos Frontend

### Páginas (`frontend/src/pages/`)

| Fichero | Ruta | Estado Iter. 2 |
|---|---|---|
| `index.astro` | `/` | MODIFICAR: carrusel + parroquia dinámica |
| `eventos/index.astro` | `/eventos` | MODIFICAR: filtros, vista tabla/cards, permisos |
| `contacto.astro` | `/contacto` | NUEVO |
| `admin/index.astro` | `/admin` | MODIFICAR: dashboard con tarjetas clicables |
| `monitor/index.astro` | `/monitor` | MODIFICAR: lista de monitores (solo admin) |
| `panel-monitor/index.astro` | `/panel-monitor` | NUEVO/MODIFICAR: dashboard personal monitor |
| `usuarios/index.astro` | `/usuarios` | MODIFICAR: buscador con filtros expandibles |
| `login.astro` | `/login` | MODIFICAR: campo enlace ficha, redirect por rol |
| `configuracion/index.astro` | `/configuracion` | NUEVO: panel admin estable y extensible |
| `register/[token].astro` | `/register/:token` | Sin cambios Iter. 2 |
| `ficha/[token].astro` | `/ficha/:token` | Sin cambios Iter. 2 |

### Componentes (`frontend/src/components/`)

| Fichero | Descripción | Estado |
|---|---|---|
| `Navbar.astro` | Navbar responsive con ítems por rol | MODIFICAR |
| `Toast.astro` | Sistema de notificaciones en pantalla | NUEVO |
| `Carrusel.astro` | Carrusel de eventos para inicio | NUEVO |
| `EventoCard.astro` | Card de evento reutilizable | NUEVO/REVISAR |
| `BuscadorFiltros.astro` | Buscador expandible con filtros | NUEVO |
| `ErrorBoundary.astro` | Wrapper de gestión de errores | NUEVO |
| `ParroquiaInfo.astro` | Bloque de info de parroquia editable | NUEVO |
| `DashboardCard.astro` | Tarjeta clicable para dashboards | NUEVO |

### Layouts (`frontend/src/layouts/`)

- `Layout.astro` — MODIFICAR: inyectar variables CSS desde `configuracion`, incluir `Toast.astro` global

---

## Política de Gestión de Errores (Iteración 2)

### En el backend

Todo error debe seguir el formato estándar:
```json
{ "error": { "code": "EVENTO_NOT_FOUND", "message": "El evento no existe o no está activo" } }
```

Códigos HTTP correctos:
- `400` validación de input
- `401` no autenticado
- `403` sin permisos para esa operación
- `404` recurso no encontrado
- `413` archivo demasiado grande
- `429` rate limit superado
- `500` error interno (no exponer stack trace en producción)

CORS mal configurado → el proxy Nginx o el middleware deben devolver `403` con cabecera `X-Error-Reason: cors-rejected` y log en servidor.

### En el frontend

Cada fetch debe tener su `try/catch` con manejo explícito según esta tabla:

| Código | Comportamiento en UI |
|---|---|
| Error de red / CORS | `Toast` rojo, mensaje "Error de conexión. Inténtalo de nuevo." |
| `401` | Redirigir a `/login` + `Toast` informativo "Sesión expirada" |
| `403` | `Toast` naranja "No tienes permisos para esta acción" |
| `404` | Mensaje inline dentro del componente afectado |
| `400` | Error inline bajo el campo del formulario con fallo |
| `413` | `Toast` naranja "El archivo supera el tamaño máximo (5 MB)" |
| `429` | `Toast` naranja "Demasiados intentos. Espera unos minutos." |
| `500` | `Toast` rojo "Error del servidor. Código: 500. Contacta con el administrador." |

Reglas:
- **Nunca** una acción silenciosa (sin spinner, sin toast, sin error visible)
- Spinner mientras el fetch está en curso (`loading = true`)
- `ErrorBoundary.astro` como wrapper para secciones que cargan datos externos
- Los errores críticos (5xx, CORS) también se loguean en `console.error` con contexto

---

## Flujo de Trabajo del Agente

```
1. Leer CHANGELOG.md → entender versión actual y cambios recientes
2. Leer INSTRUCTIONS.md → entender requerimientos de la iteración a implementar
3. Leer SKILL.md → consultar esquema BD y contratos de API
4. Leer AGENT_SECURITY.md → verificar antes de cambios en auth, rutas o archivos
5. Identificar el módulo afectado (backend route / frontend page / componente)
6. Implementar respetando: política de errores, CORS, validación de rol en backend
7. Añadir o actualizar smoke tests en /test si hay nuevos endpoints
8. Añadir entrada en CHANGELOG.md con versión, tipo de cambio y ficheros afectados
9. Actualizar TESTING.md si hay nuevos casos de prueba
```

---

## Restricciones Absolutas

- **Nunca** procesar pagos reales
- **Nunca** servir archivos adjuntos sin validar propiedad del solicitante
- **Nunca** exponer rutas internas del servidor en respuestas JSON
- **Nunca** permitir a un monitor acceder a jóvenes de otro monitor
- **Nunca** almacenar contraseñas en texto plano
- **Nunca** ejecutar archivos subidos por usuarios
- **Nunca** mostrar el token personal del joven más de una vez
- **Nunca** URL hardcodeada en el frontend (siempre `PUBLIC_API_URL`)
- **Nunca** acción silenciosa en el frontend sin feedback visual

---

## Comandos

```bash
# Levantar todo
docker compose up --build

# Desarrollo local backend
cd backend && npm run dev

# Desarrollo local frontend
cd frontend && npm run dev

# Migraciones
docker-compose exec backend npm run migrate

# Seed (crea admin por defecto, tipos de evento, configuración inicial)
docker-compose exec backend npm run seed

# Smoke tests
npm run smoke:api       # regresión admin + eventos + asignaciones
npm run smoke:youth     # flujo registro joven + ficha + documentos
npm run smoke:roles     # validación de permisos por rol

# Logs
docker compose logs -f backend
docker compose logs -f nginx
```

---

## Referencias

- Requerimientos completos: `INSTRUCTIONS.md`
- Historial de cambios: `CHANGELOG.md`
- Esquema BD y API: `SKILL.md`
- Checklist de seguridad: `AGENT_SECURITY.md`
- Plan de pruebas: `TESTING.md`
