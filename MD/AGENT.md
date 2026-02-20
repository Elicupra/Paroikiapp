# AGENT — Paroikiapp

> Versión: Iteración 1
> Referencia completa de requerimientos: `INSTRUCTIONS.md`

## Propósito

Agente de desarrollo y mantenimiento para Paroikiapp, sistema de registro de eventos juveniles de parroquia (campamentos, peregrinaciones, viajes). Cubre el ciclo completo desde scaffolding hasta despliegue en homelab.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| Frontend | Astro (SSR) |
| Proxy | Nginx |
| Contenedores | Docker Compose |
| Auth | JWT (15 min) + refresh token httpOnly |
| Email | Nodemailer + SMTP externo |

---

## Roles y Permisos

### Administrador
- Creado en el seed inicial del despliegue; puede existir más de uno
- Acceso total: eventos, tipos de evento, usuarios, monitores, estadísticas
- Puede crear, editar y borrar cualquier entidad
- Gestiona la asignación de eventos a monitores
- Puede restringir el máximo de jóvenes por monitor por evento (`max_jovenes`)
- Puede reajustar precios: cambio de coste por persona o descuento global
- Ve la recaudación total y por monitor de cada evento
- Accede a FAQ completa (todos los roles)

### Monitor
- Solo existe cuando el Administrador lo crea (no hay auto-registro)
- Ve únicamente los eventos que el Administrador le asigna
- Ve únicamente los jóvenes que él administra dentro de cada evento
- Puede editar y borrar sus propios jóvenes
- Registra pagos; tiene casilla especial para pagos distintos al esperado
- Accede al detalle de un joven desde el evento haciendo clic en su nombre
- Ve la recaudación de su grupo y el total esperado
- Gestiona su información y preferencias de notificación desde Panel Monitor

### Joven (participante, sin cuenta de usuario)
- Accede a su ficha personal mediante enlace único generado en el registro
- Puede modificar sus datos y subir documentos (Autorización Paterna, Tarjeta Sanitaria)
- No tiene acceso a ninguna otra parte de la aplicación

### Anónimo
- Accede a la landing page: info de la parroquia, eventos actuales, login
- No accede a ninguna sección protegida

---

## Navbar — Visibilidad por Rol

| Sección | Anónimo | Monitor | Admin |
|---|---|---|---|
| Inicio | ✅ | ✅ | ✅ |
| Panel Administrador | ❌ | ❌ | ✅ |
| Panel Monitor | ❌ | ✅ | ✅ |
| Eventos | ❌ | ✅ | ✅ |
| FAQ | ❌ | ✅ | ✅ |
| Contacto | ✅ | ✅ | ✅ |

La navbar es completamente responsive (hamburger en mobile). El rol se determina desde el JWT; si no hay token válido, se muestra la vista anónima.

---

## Flujo del Enlace de Registro

1. El administrador crea el evento y asigna monitores
2. Cada monitor tiene un enlace único de registro (`/register/:monitor_token`)
3. El monitor comparte ese enlace con los jóvenes de su grupo
4. El joven accede, rellena nombre, apellidos y opcionalmente sube documentos
5. Tras el submit, se genera un **enlace personal único** para ese joven (`/ficha/:joven_token`)
6. Ese enlace se muestra **una sola vez** en pantalla con botón de copiar
7. Con ese enlace el joven puede, en el futuro: ver y editar su ficha, subir documentos
8. El joven no accede a ningún otro endpoint de la aplicación

---

## Lógica de Eventos con Coste 0

Si el administrador crea un evento con coste = 0:
- Se muestra un modal de advertencia y se requiere confirmación explícita
- Si se confirma: el campo `coste_cero = true` se activa en BD
- Con `coste_cero = true`: no se muestran precios en ninguna vista, no aplica lógica de pagos ni plazos

---

## Responsabilidades del Agente por Módulo

### backend/src/routes/
- `auth.js` — login, refresh, logout, cambio de contraseña y email
- `register.js` — endpoints públicos de registro por token de monitor
- `ficha.js` — endpoints del joven por su token personal (sin auth de usuario)
- `monitor.js` — endpoints protegidos para monitor autenticado
- `admin.js` — endpoints protegidos para administrador
- `public.js` — landing page data (eventos publicados, info parroquia)

### backend/src/middleware/
- `auth.js` — verificación JWT, extracción de rol
- `roles.js` — guards: `requireAdmin`, `requireMonitor`, `requireAdminOrMonitor`
- `rateLimiter.js` — límites por IP, más estrictos en /login
- `upload.js` — multer con validación MIME real (file-type), límite 5 MB, rename UUID
- `sanitize.js` — sanitización de inputs con zod o joi

### backend/src/services/
- `notifications.js` — email al monitor cuando se registra un joven
- `stats.js` — cálculo de recaudación por evento/monitor

### frontend/src/pages/
- `index.astro` — landing pública
- `login.astro` — formulario de login
- `register/[token].astro` — formulario de registro del joven
- `ficha/[token].astro` — ficha personal del joven
- `admin/` — panel administrador (eventos, usuarios, monitores, tipos)
- `monitor/` — panel monitor (info propia, notificaciones)
- `eventos/` — vista de eventos (diferente según rol)
- `faq.astro` — guía de uso (diferente contenido según rol)
- `contacto.astro` — página de contacto pública

### frontend/src/components/
- `Navbar.astro` — navbar responsive con visibilidad por rol
- `EventoCard.astro` — tarjeta de evento
- `JovenRow.astro` — fila de joven en tabla de monitor (incluye casilla de pago especial)
- `PagoForm.astro` — formulario de pago por plazo
- `DocumentUpload.astro` — componente de subida de documentos

---

## Flujo de Trabajo del Agente

```
1. Leer INSTRUCTIONS.md para contexto de requerimientos
2. Leer SKILL.md para esquema de BD y contratos de API
3. Leer AGENT_SECURITY.md antes de cualquier cambio en auth, rutas o subida de archivos
4. Identificar el módulo afectado
5. Implementar respetando las restricciones de seguridad
6. Actualizar o añadir tests en /test
7. Verificar que no hay queries sin parametrizar
8. Actualizar CHANGELOG.md
```

---

## Restricciones Absolutas

- **Nunca** procesar pagos reales ni integrar pasarelas de pago
- **Nunca** exponer rutas internas del servidor en respuestas JSON
- **Nunca** permitir que un monitor acceda a jóvenes de otro monitor
- **Nunca** almacenar contraseñas en texto plano
- **Nunca** ejecutar archivos subidos por usuarios
- **Nunca** mostrar el enlace personal del joven más de una vez en el flujo de registro
- **Nunca** servir archivos adjuntos sin validar propiedad del solicitante

---

## Comandos Útiles

```bash
# Levantar entorno completo
docker compose up --build

# Solo backend en desarrollo
cd backend && npm run dev

# Ejecutar migraciones
npm run migrate --prefix backend

# Seed inicial (crea admin por defecto)
npm run seed --prefix backend

# Tests
npm test --prefix backend

# Logs
docker compose logs -f backend
docker compose logs -f nginx
```

---

## Referencias

- Historial de requerimientos: `INSTRUCTIONS.md`
- Esquema BD y contratos API: `SKILL.md`
- Checklist de seguridad: `AGENT_SECURITY.md`
