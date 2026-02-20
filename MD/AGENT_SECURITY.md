# AGENT — Seguridad (Paroikiapp)

> Versión: Iteración 1
> Se ejecuta antes de cada release o cuando se modifica auth, rutas, subida de archivos o BD.

---

## Checklist de Seguridad por Módulo

### Autenticación y Sesiones

- [ ] Las contraseñas se hashean con bcrypt (mínimo 12 rondas)
- [ ] JWT de acceso tiene expiración corta (≤ 15 min)
- [ ] Refresh token en cookie `httpOnly`, `Secure`, `SameSite=Strict`
- [ ] El endpoint `/refresh` valida que el refresh token existe en BD (no solo firma)
- [ ] Al cambiar contraseña se invalidan todos los refresh tokens del usuario
- [ ] El mensaje de error de login no distingue "usuario no existe" de "contraseña incorrecta"
- [ ] El nombre de usuario no es modificable por el propio usuario (solo admin puede cambiarlo)

### Control de Acceso y Roles

- [ ] Cada request al backend verifica el rol desde el JWT, **nunca desde el frontend**
- [ ] `requireAdmin` rechaza tokens de monitor aunque estén bien firmados
- [ ] `requireMonitor` rechaza tokens de usuario sin rol asignado
- [ ] Un monitor solo puede leer/escribir jóvenes de su propio grupo (filtro por `monitor_id` en BD)
- [ ] La asignación de eventos a monitores se valida en cada request de monitor (tabla `asignacion_eventos`)
- [ ] El límite `max_jovenes` se comprueba en el backend antes de aceptar un nuevo registro
- [ ] Los endpoints de ficha del joven (`/ficha/:token`) solo permiten operaciones sobre ese joven concreto

### Enlace Personal del Joven

- [ ] El token del joven es un UUID v4 generado con `crypto.randomUUID()`
- [ ] El token se muestra **una única vez** en el flujo de registro; no vuelve a aparecer
- [ ] El endpoint `/ficha/:token` nunca expone datos de otros jóvenes
- [ ] El endpoint `/ficha/:token` solo acepta PATCH sobre los campos del propio joven
- [ ] No existe ningún endpoint que liste todos los tokens de jóvenes (ni siquiera para admin)

### SQL y Base de Datos

- [ ] Toda query usa prepared statements o métodos ORM parametrizados
- [ ] No existe ninguna query con concatenación de string de usuario
- [ ] Las columnas sensibles (`password_hash`, `enlace_token`, `joven_token`) nunca se devuelven en listados
- [ ] Los UUIDs se generan con `crypto.randomUUID()` (Node nativo), nunca con Math.random()
- [ ] Las migraciones están versionadas y nunca se ejecutan manualmente en producción

### Subida de Archivos

- [ ] Se valida el MIME type real con la librería `file-type` (no solo la extensión declarada)
- [ ] Tamaño máximo: 5 MB por archivo
- [ ] Tipos permitidos: PDF, JPEG, PNG, WEBP y texto plano
- [ ] El archivo se renombra con UUID antes de guardarse, descartando el nombre original
- [ ] La ruta de almacenamiento está fuera del webroot de Nginx
- [ ] El endpoint de descarga verifica que el solicitante tiene propiedad o permiso sobre ese documento
- [ ] No se ejecuta ningún archivo subido bajo ninguna circunstancia

### API, Red y Cabeceras

- [ ] Rate limiting activo en todos los endpoints públicos (express-rate-limit)
- [ ] Rate limiting estricto en `/api/auth/login`: máx. 5 intentos / 15 min por IP
- [ ] Rate limiting en `/register/:token`: máx. 10 intentos / hora por IP
- [ ] CORS configurado con `origin` explícito al dominio del frontend (nunca `*`)
- [ ] `helmet` activo con CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] Nginx tiene límite de conexiones simultáneas y tamaño máximo de body (`client_max_body_size 6m`)
- [ ] Fail2ban monitoriza logs de Nginx para bloquear IPs con múltiples 401/403/429

### Secretos y Configuración

- [ ] `.env` incluido en `.gitignore`
- [ ] No hay credenciales hardcodeadas en el código fuente ni en Dockerfiles
- [ ] `JWT_SECRET` tiene al menos 64 caracteres aleatorios
- [ ] En producción, los secretos se inyectan via variable de entorno del host o Docker Secrets
- [ ] El seed inicial genera la contraseña del admin por defecto de forma segura y la muestra una sola vez en consola

### Notificaciones por Email

- [ ] Las credenciales SMTP están exclusivamente en `.env`
- [ ] Los emails de notificación no incluyen datos sensibles (sin importes exactos, sin tokens, sin rutas)
- [ ] Se valida formato de email antes de guardar en BD
- [ ] El campo `reply-to` apunta al monitor, no a una dirección interna del sistema

---

## Vectores de Ataque Específicos de esta App

### Token de monitor expuesto
**Riesgo:** si el enlace de registro se filtra, alguien externo puede registrar jóvenes falsos.
**Mitigación:** rate limiting por IP en `/register/:token`, log de todos los registros con IP y timestamp, revocación manual desde panel admin.

### Token personal del joven expuesto
**Riesgo:** si alguien obtiene el token puede modificar los datos del joven.
**Mitigación:** el token solo se muestra una vez, se recomienda al joven guardarlo en lugar seguro. No existe endpoint de recuperación del token (solo el monitor o admin puede ver la ficha desde el panel autenticado).

### Escalada de rol
**Riesgo:** un monitor intenta acceder a rutas de admin manipulando la URL.
**Mitigación:** `requireAdmin` en el backend valida el campo `rol` del JWT en cada request, independientemente de la URL.

### Enumeración de jóvenes
**Riesgo:** atacante prueba UUIDs secuenciales o aleatorios en `/ficha/:token`.
**Mitigación:** UUIDs v4 son no predecibles; rate limiting en el endpoint; errores 404 idénticos para token inválido y token válido sin datos (no revelar existencia).

---

## Respuesta ante Incidentes

### Token de monitor comprometido
1. El admin revoca el token desde el panel (marca `activo = false`)
2. Se genera nuevo token para el monitor
3. Se revisan logs de acceso para detectar registros fraudulentos
4. Si se detectan jóvenes falsos, el admin o monitor los elimina

### Credencial de usuario comprometida
1. Invalidar todos los refresh tokens del usuario en BD
2. Forzar restablecimiento de contraseña por email
3. Notificar al administrador responsable

### Intento de SQL Injection detectado
1. Fail2ban bloquea la IP automáticamente
2. Se revisan los logs para confirmar que el ORM absorbió el ataque sin brecha
3. Si hay brecha confirmada: activar modo mantenimiento, auditar BD, notificar afectados

---

## Herramientas Recomendadas

| Herramienta | Uso |
|---|---|
| `helmet` | Cabeceras HTTP de seguridad |
| `express-rate-limit` | Rate limiting por IP |
| `bcrypt` | Hashing de contraseñas |
| `file-type` | Validación real de MIME type |
| `zod` | Validación y sanitización de inputs |
| `fail2ban` | Bloqueo de IPs en el host |
| `OWASP ZAP` | Escaneo periódico de vulnerabilidades |

---

## Referencias

- Diseño general: `AGENT.md`
- Requerimientos: `INSTRUCTIONS.md`
- Esquema BD y API: `SKILL.md`
- OWASP Top 10: https://owasp.org/www-project-top-ten/
