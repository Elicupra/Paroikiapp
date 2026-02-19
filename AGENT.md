# AGENT — Registro de Eventos (Camp Register)

## Propósito

Agente de desarrollo y mantenimiento para la aplicación de registro de eventos juveniles (campamentos, peregrinaciones, viajes). Gestiona el ciclo completo: desde scaffolding inicial hasta despliegue en homelab.

---

## Contexto del Proyecto

- **Repositorio:** `camp-register/`
- **Entorno objetivo:** Homelab con Docker Compose
- **Stack:** Node.js + Express (backend) · Astro (frontend) · PostgreSQL (BD) · Nginx (proxy)
- **Usuarios:** Monitores, organizadores y jóvenes (solo lectura/escritura propia)

---

## Responsabilidades del Agente

### 1. Backend (Express)

- Mantener y extender los endpoints REST bajo `backend/src/routes/`
- Aplicar siempre **prepared statements** o consultas ORM (Drizzle/Prisma); nunca concatenar variables de usuario en SQL
- Validar y sanitizar toda entrada en `backend/src/middleware/` antes de que llegue al controlador
- Gestionar subida de archivos: validar MIME type real, renombrar con UUID, almacenar fuera del webroot
- Cualquier endpoint que sirva archivos adjuntos debe verificar el rol y la propiedad del recurso antes de responder

### 2. Frontend (Astro)

- Las páginas de formulario público (registro de joven) se renderizan en servidor (SSR)
- El panel de gestión (monitores/organizadores) puede usar componentes interactivos solo donde sea necesario
- Nunca exponer tokens, rutas internas o datos de otros usuarios en el HTML renderizado al cliente

### 3. Base de Datos (PostgreSQL)

- Seguir el esquema definido en `SKILL.md` (tablas: eventos, monitores, jovenes, documentos, pagos, usuarios)
- Las migraciones se versionan en `backend/src/models/migrations/`
- Nunca modificar tablas en producción sin migración versionada

### 4. Seguridad

- Revisar todo código nuevo contra la checklist de `SKILL.md > Sección Seguridad`
- Rate limiting activo en todos los endpoints públicos
- CORS restringido al dominio del frontend
- JWT de corta duración + refresh token en cookie httpOnly
- Variables sensibles solo en `.env` (excluido de git) o Docker Secrets

### 5. Notificaciones (Email / Webhook)

- El sistema de notificaciones vive en `backend/src/services/notifications.js`
- Se usa Nodemailer con SMTP externo (Brevo, Resend, o SMTP propio)
- Eventos que disparan notificación: nuevo joven registrado (avisa al monitor), pago registrado, documento adjuntado
- Los webhooks salientes siguen el contrato definido en `SKILL.md > Webhooks`

---

## Flujo de Trabajo del Agente

```
1. Leer SKILL.md para contexto completo del proyecto
2. Identificar el módulo afectado (routes / controllers / models / frontend / notifications)
3. Implementar el cambio respetando las restricciones de seguridad
4. Añadir o actualizar tests unitarios relevantes
5. Verificar que no se introducen queries sin parametrizar
6. Documentar el cambio en CHANGELOG.md
```

---

## Restricciones Absolutas

- **Nunca** procesar pagos reales ni integrar pasarelas de pago
- **Nunca** exponer rutas de archivos del servidor en respuestas JSON
- **Nunca** permitir que un monitor acceda a datos de jóvenes de otro monitor
- **Nunca** almacenar contraseñas en texto plano
- **Nunca** ejecutar archivos subidos por usuarios

---

## Comandos Útiles

```bash
# Levantar entorno de desarrollo
docker compose up --build

# Ejecutar migraciones
npm run migrate --prefix backend

# Tests
npm test --prefix backend

# Logs en tiempo real
docker compose logs -f backend
```

---

## Referencias

- Esquema completo y decisiones de diseño: `SKILL.md`
- Variables de entorno requeridas: `backend/.env.example`
- Changelog: `CHANGELOG.md`
