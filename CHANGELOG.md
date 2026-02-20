# CHANGELOG

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
