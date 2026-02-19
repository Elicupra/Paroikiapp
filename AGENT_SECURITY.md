# AGENT — Seguridad (Camp Register)

## Propósito

Agente especializado en auditoría y hardening de seguridad para la aplicación de registro de eventos. Se ejecuta antes de cada release o cuando se introducen cambios en autenticación, rutas, modelos o subida de archivos.

---

## Checklist de Seguridad por Módulo

### Autenticación y Sesiones

- [ ] Las contraseñas se hashean con bcrypt (mínimo 12 rondas)
- [ ] JWT de acceso tiene expiración corta (≤ 15 min)
- [ ] Refresh token en cookie `httpOnly`, `Secure`, `SameSite=Strict`
- [ ] El endpoint `/refresh` valida que el refresh token existe en BD (no solo firma)
- [ ] Al cambiar contraseña se invalidan todos los refresh tokens del usuario
- [ ] No se expone información en mensajes de error de login (no distinguir "usuario no existe" de "contraseña incorrecta")

### Control de Acceso

- [ ] Cada request al backend verifica el rol desde el JWT, no desde el frontend
- [ ] Un monitor solo puede leer/escribir jóvenes de su propio grupo (validación por `monitor_id`)
- [ ] Los organizadores tienen un rol explícito diferenciado en BD
- [ ] Los endpoints de administración rechazan tokens de monitor aunque estén bien firmados
- [ ] Los enlaces UUID solo permiten escritura del propio joven, nunca lectura de otros registros

### SQL y Base de Datos

- [ ] Toda query usa prepared statements o métodos ORM parametrizados
- [ ] No existe ninguna query con concatenación de string de usuario: `"SELECT * FROM " + userInput` → **PROHIBIDO**
- [ ] Las columnas sensibles (password_hash) nunca se devuelven en respuestas de API
- [ ] Los UUIDs se generan con `crypto.randomUUID()` (Node nativo), no con Math.random()

### Subida de Archivos

- [ ] Se valida el MIME type real con `file-type` (no solo la extensión declarada)
- [ ] Tamaño máximo: 5 MB por archivo
- [ ] El archivo se renombra con UUID antes de guardarse
- [ ] La ruta de almacenamiento está fuera del webroot de Nginx
- [ ] No se ejecuta ningún archivo subido bajo ninguna circunstancia
- [ ] El endpoint de descarga de archivo verifica propiedad antes de servir

### API y Red

- [ ] Rate limiting activo en todos los endpoints públicos (express-rate-limit)
- [ ] Rate limiting más estricto en `/login` y `/register` (máx. 5 intentos / 15 min por IP)
- [ ] CORS configurado con `origin` explícito (no `*`)
- [ ] Cabeceras de seguridad activas: `helmet` configurado con CSP, HSTS, X-Frame-Options
- [ ] Nginx tiene límite de conexiones simultáneas y tamaño máximo de body
- [ ] Fail2ban monitoriza logs de Nginx para bloquear IPs con múltiples 401/403

### Secretos y Configuración

- [ ] `.env` incluido en `.gitignore`
- [ ] No hay credenciales hardcodeadas en el código fuente
- [ ] `JWT_SECRET` tiene al menos 64 caracteres aleatorios
- [ ] En producción, los secretos se inyectan via Docker Secrets o variable de entorno del host, no desde archivo

### Notificaciones por Email

- [ ] Las credenciales SMTP están en `.env`, nunca en código
- [ ] Los emails de notificación no incluyen datos sensibles del joven (solo nombre y evento)
- [ ] El campo `reply-to` del email apunta al monitor, no a una dirección interna del sistema
- [ ] Se valida el formato del email del monitor antes de registrarlo en BD

---

## Respuesta ante Incidentes

### Enlace UUID comprometido
1. Revocar el enlace desde el panel de organizador (marcar `activo = false` en BD)
2. Revisar logs de acceso para identificar registros fraudulentos
3. Generar nuevo enlace UUID para el monitor afectado

### Credencial de usuario comprometida
1. Invalidar todos los refresh tokens del usuario en BD
2. Forzar restablecimiento de contraseña por email
3. Notificar al organizador responsable

### Intento de SQL Injection detectado
1. Fail2ban bloquea la IP automáticamente si hay múltiples intentos
2. Revisar logs para confirmar que el ORM/prepared statements absorbió el ataque
3. Si hay brecha, activar modo mantenimiento y auditar la BD

---

## Herramientas Recomendadas

| Herramienta | Uso |
|---|---|
| `helmet` | Cabeceras HTTP de seguridad |
| `express-rate-limit` | Rate limiting por IP |
| `bcrypt` | Hashing de contraseñas |
| `file-type` | Validación real de MIME type |
| `zod` o `joi` | Validación y sanitización de input |
| `fail2ban` | Bloqueo de IPs en el host |
| `OWASP ZAP` | Escaneo de vulnerabilidades periódico |

---

## Referencias

- Diseño general del proyecto: `AGENT.md`
- Esquema de BD y contratos de API: `SKILL.md`
- OWASP Top 10: https://owasp.org/www-project-top-ten/
