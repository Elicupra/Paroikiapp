# CHANGELOG

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
