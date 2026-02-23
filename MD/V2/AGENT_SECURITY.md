# AGENT — Seguridad (Paroikiapp)

> Versión: Iteración 2
> Ejecutar antes de cualquier release o cuando se modifique: auth, rutas, subida de archivos, CORS, BD.

---

## Checklist por Módulo

### Autenticación y Sesiones

- [ ] Contraseñas hasheadas con bcrypt (mínimo 12 rondas)
- [ ] JWT de acceso con expiración ≤ 15 min
- [ ] Refresh token en cookie `httpOnly`, `Secure`, `SameSite=Strict`
- [ ] El endpoint `/refresh` valida el token contra la tabla `refresh_tokens` en BD (no solo firma)
- [ ] Al cambiar contraseña → se eliminan todos los refresh tokens del usuario en BD
- [ ] El mensaje de error de login NO distingue "usuario no existe" de "contraseña incorrecta"
- [ ] `nombre_mostrado` es modificable por el usuario; el email como identificador NO es el "nombre de usuario"

### Control de Acceso y Roles

- [ ] Cada request verifica el rol desde el JWT en el backend, **nunca desde el frontend**
- [ ] `requireAdmin` rechaza tokens de monitor aunque estén bien firmados
- [ ] Un monitor solo puede operar sobre sus propios jóvenes (filtro `monitor_id` en BD)
- [ ] La asignación de eventos se valida en cada request (tabla `asignacion_eventos`)
- [ ] `max_jovenes` se comprueba en backend antes de aceptar un nuevo registro
- [ ] Los endpoints `/ficha/:token` solo permiten operaciones sobre ese joven concreto
- [ ] Los ficheros privados de monitor (`monitor_ficheros`) solo son accesibles por el propio monitor o admin
- [ ] El panel de configuración (`/api/admin/configuracion`) es de acceso exclusivo para admin

### CORS (crítico — nuevo en Iteración 2)

- [ ] El middleware CORS usa exclusivamente `FRONTEND_URL` de `.env` como origen permitido
- [ ] No existe `origin: '*'` en ningún entorno (ni desarrollo)
- [ ] Las peticiones desde origen no autorizado reciben `403` con cabecera `X-Error-Reason: cors-rejected`
- [ ] El error CORS se registra en el log del servidor con IP y origen rechazado
- [ ] El frontend Astro siempre envía peticiones desde `PUBLIC_API_URL` (nunca hardcodeado)
- [ ] En desarrollo local se usa un `.env.development` con `FRONTEND_URL=http://localhost:4321`

### Enlace Personal del Joven

- [ ] El token del joven es UUID v4 generado con `crypto.randomUUID()`
- [ ] Se muestra **una única vez** tras el registro; no vuelve a aparecer en ninguna pantalla
- [ ] El endpoint `/ficha/:token` nunca expone datos de otros jóvenes
- [ ] Los errores de token inválido y token válido sin datos devuelven el mismo 404 (no revelar existencia)
- [ ] No existe ningún endpoint que liste todos los tokens de jóvenes

### SQL y Base de Datos

- [ ] Toda query usa prepared statements o métodos ORM parametrizados
- [ ] No existe ninguna query con concatenación de string de usuario
- [ ] Columnas sensibles (`password_hash`, `enlace_token`, `token_hash`) nunca en respuestas de API
- [ ] UUIDs generados con `crypto.randomUUID()` (nunca `Math.random()`)
- [ ] Migraciones versionadas; nunca ALTER TABLE manual en producción

### Subida de Archivos

- [ ] MIME type real validado con `file-type` (no solo extensión)
- [ ] Tipos permitidos: PDF, JPEG, PNG, WEBP, texto plano
- [ ] Tamaño máximo: 5 MB por archivo (`client_max_body_size 6m` en Nginx)
- [ ] Archivo renombrado con UUID antes de guardar
- [ ] Ruta de almacenamiento fuera del webroot
- [ ] El endpoint de descarga valida propiedad antes de servir
- [ ] Protección contra path traversal: la ruta resuelta debe quedar dentro de `UPLOADS_PATH`
- [ ] No se ejecuta ningún archivo subido

### API, Red y Cabeceras

- [ ] Rate limiting en todos los endpoints públicos
- [ ] Rate limiting estricto en `/api/auth/login`: máx. 5 intentos / 15 min por IP
- [ ] Rate limiting en `/register/:token`: máx. 10 intentos / hora por IP
- [ ] `helmet` activo: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] Nginx: límite de conexiones y `client_max_body_size 6m`
- [ ] Fail2ban monitoriza logs de Nginx (bloqueo de IPs con múltiples 401/403/429)
- [ ] Contenido dinámico escapado en respuestas HTML (prevención XSS)

### Configuración y Secretos

- [ ] `.env` en `.gitignore`; nunca credenciales hardcodeadas
- [ ] `JWT_SECRET` tiene mínimo 64 caracteres aleatorios
- [ ] En producción: secretos via variable de entorno del host o Docker Secrets
- [ ] El seed genera la contraseña del admin por defecto de forma segura (muestra en consola una vez)
- [ ] La tabla `configuracion` no almacena secretos; solo datos de presentación

### Gestión de Errores (nueva política — Iteración 2)

- [ ] El handler global `errorHandler.js` intercepta todos los errores no capturados
- [ ] En producción (`NODE_ENV=production`): stack traces NO se exponen en respuestas
- [ ] En desarrollo: stack traces en respuesta para facilitar depuración
- [ ] Los errores 5xx se loguean en servidor con contexto (endpoint, IP, timestamp)
- [ ] Los errores CORS se loguean con IP y origen rechazado
- [ ] El frontend tiene `try/catch` en cada fetch; ninguna acción silenciosa

### Email y Contacto

- [ ] Credenciales SMTP exclusivamente en `.env`
- [ ] Los emails de notificación no incluyen tokens, rutas ni contraseñas
- [ ] El formulario de contacto tiene rate limiting (`/api/public/contacto`): máx. 5 envíos / hora por IP
- [ ] El campo `email` del formulario de contacto se valida en backend (formato válido)
- [ ] El `reply-to` del email apunta al remitente del formulario, no a una dirección interna

---

## Vectores de Ataque Específicos

### Token de monitor expuesto
- Rate limiting en `/register/:token`
- Log de todos los registros con IP y timestamp
- Revocación manual desde panel admin
- El token no aparece en logs de Nginx (configurar `log_format` sin path params sensibles)

### Token personal del joven expuesto
- Mostrado una sola vez; sin endpoint de recuperación
- Rate limiting en `/ficha/:token`
- 404 idéntico para token inválido y token válido sin datos

### Configuración editable por admin
- La tabla `configuracion` solo permite claves predefinidas (whitelist en el backend)
- El valor de `parroquia_logo` se valida como URL o base64 de imagen, nunca como HTML
- Los valores de `color_*` se validan como hex color (`/^#[0-9A-Fa-f]{6}$/`)
- El campo `app_nombre` se sanitiza antes de renderizar (prevenir XSS en el nombre)

### Escalada de rol vía `/login`
- El campo "pegar enlace de ficha" en `/login` no procesa HTML ni scripts
- Si el input no comienza por `/ficha/` seguido de UUID, se ignora y no redirige

### Enumeración de usuarios via formulario de contacto
- El endpoint no confirma si el email del remitente existe en el sistema
- Respuesta siempre `200 { ok: true }` independientemente de si el email es válido

---

## Respuesta ante Incidentes

### Token de monitor comprometido
1. Admin revoca el token desde panel (marca `activo = false` + regenera UUID)
2. Revisar logs de acceso para detectar registros fraudulentos
3. Si se detectan jóvenes falsos, admin o monitor los elimina

### Credencial de usuario comprometida
1. Invalidar todos los refresh tokens del usuario en BD
2. Forzar restablecimiento de contraseña por email
3. Notificar al administrador

### Brecha de SQL Injection
1. Fail2ban bloquea la IP
2. Revisar logs para confirmar que el ORM absorbió el ataque
3. Si hay brecha: modo mantenimiento, auditar BD, notificar afectados

### Error CORS inesperado en producción
1. Verificar `FRONTEND_URL` en `.env` del backend
2. Verificar `PUBLIC_API_URL` en `.env` del frontend
3. Revisar configuración de Nginx (no debe reescribir cabeceras CORS)
4. Comprobar que no hay peticiones cross-origin desde scripts de terceros

---

## Herramientas

| Herramienta | Uso |
|---|---|
| `helmet` | Cabeceras HTTP de seguridad |
| `express-rate-limit` | Rate limiting por IP |
| `bcrypt` | Hashing de contraseñas |
| `file-type` | Validación real de MIME type |
| `zod` | Validación y sanitización de inputs |
| `cors` (npm) | Middleware CORS con whitelist |
| `fail2ban` | Bloqueo de IPs en el host |
| `OWASP ZAP` | Escaneo periódico de vulnerabilidades |

---

## Referencias

- Diseño general: `AGENT.md`
- Requerimientos: `INSTRUCTIONS.md`
- Esquema BD y API: `SKILL.md`
- OWASP Top 10: https://owasp.org/www-project-top-ten/
