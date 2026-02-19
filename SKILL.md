# SKILL — Camp Register

## Descripción

Skill para desarrollar, mantener y extender la aplicación de registro de eventos juveniles. Cubre el esquema de base de datos, contratos de API, sistema de notificaciones y convenciones de código.

---

## Esquema de Base de Datos (PostgreSQL)

```sql
-- Tipos de evento reutilizables
CREATE TYPE tipo_evento AS ENUM ('campamento', 'peregrinacion', 'viaje', 'otro');
CREATE TYPE rol_usuario AS ENUM ('monitor', 'organizador');
CREATE TYPE tipo_documento AS ENUM ('autorizacion_paterna', 'tarjeta_sanitaria');

CREATE TABLE eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo tipo_evento NOT NULL DEFAULT 'campamento',
  precio_base NUMERIC(8,2),
  fecha_inicio DATE,
  fecha_fin DATE,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol rol_usuario NOT NULL DEFAULT 'monitor',
  nombre_mostrado TEXT NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE monitores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  evento_id UUID REFERENCES eventos(id) ON DELETE CASCADE,
  enlace_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  activo BOOLEAN DEFAULT true,
  UNIQUE(usuario_id, evento_id)
);

CREATE TABLE jovenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  monitor_id UUID REFERENCES monitores(id) ON DELETE RESTRICT,
  evento_id UUID REFERENCES eventos(id) ON DELETE RESTRICT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  joven_id UUID REFERENCES jovenes(id) ON DELETE CASCADE,
  tipo tipo_documento NOT NULL,
  ruta_interna TEXT NOT NULL,   -- UUID filename, never the original name
  nombre_original TEXT,          -- solo para mostrar al usuario
  mime_type TEXT NOT NULL,
  subido_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  joven_id UUID REFERENCES jovenes(id) ON DELETE CASCADE,
  plazo_numero INTEGER NOT NULL,
  cantidad NUMERIC(8,2) NOT NULL,
  pagado BOOLEAN DEFAULT false,
  es_especial BOOLEAN DEFAULT false,
  nota_especial TEXT,             -- obligatorio si es_especial = true
  descuento NUMERIC(8,2) DEFAULT 0,
  fecha_pago TIMESTAMPTZ,
  registrado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT now()
);
```

---

## Contratos de API

### Autenticación

```
POST   /api/auth/login            Body: { email, password }
POST   /api/auth/refresh          Cookie: refreshToken
POST   /api/auth/logout           Cookie: refreshToken
PATCH  /api/auth/me/password      Body: { currentPassword, newPassword }  [Auth]
PATCH  /api/auth/me/email         Body: { password, newEmail }            [Auth]
```

> El nombre de usuario (nombre_mostrado) NO es modificable por el usuario.

### Enlace público (sin auth, solo por token de monitor)

```
GET    /register/:token           Devuelve info del evento (sin datos privados)
POST   /register/:token/joven     Body: { nombre, apellidos }
POST   /register/:token/joven/:id/documento   Multipart: { tipo, file }
```

### Panel de monitor [Auth: monitor]

```
GET    /api/monitor/jovenes       Lista jóvenes del propio monitor en el evento activo
GET    /api/monitor/jovenes/:id   Detalle de un joven (solo propio)
POST   /api/monitor/pagos         Body: { joven_id, plazo_numero, cantidad, es_especial?, nota_especial? }
PATCH  /api/monitor/pagos/:id     Body: { pagado, descuento? }
```

### Panel de organizador [Auth: organizador]

```
GET    /api/admin/eventos
POST   /api/admin/eventos
GET    /api/admin/eventos/:id/jovenes
GET    /api/admin/usuarios
POST   /api/admin/usuarios        Body: { email, nombre_mostrado, rol, password_temporal }
DELETE /api/admin/monitores/:id/token   # revoca y regenera el enlace
```

### Archivos adjuntos [Auth: monitor o organizador]

```
GET    /api/documentos/:id        Sirve el archivo tras validar propiedad
```

---

## Sistema de Notificaciones por Email

### Configuración

```js
// backend/src/services/notifications.js
// Usa Nodemailer con transporte SMTP configurable via .env

SMTP_HOST=smtp.brevo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
NOTIFY_FROM="Campamento App <no-reply@tudominio.com>"
```

### Eventos que disparan notificación

| Evento | Destinatario | Asunto |
|---|---|---|
| Nuevo joven registrado | Monitor | "Nuevo participante: {nombre}" |
| Documento adjuntado | Monitor | "Documento recibido: {tipo} de {nombre}" |
| Pago registrado | Organizador (opcional) | "Pago registrado para {nombre}" |

### Plantilla de notificación (nuevo joven)

```
Hola {monitor.nombre_mostrado},

{joven.nombre} {joven.apellidos} se ha apuntado a tu grupo
en el evento "{evento.nombre}".

Puedes ver su ficha desde el panel de gestión.

Este mensaje es automático, no respondas a este correo.
```

> Los emails nunca incluyen datos sensibles (documentos, importes, contraseñas).

### Webhook saliente (opcional)

Si el monitor tiene configurada una URL de webhook, se envía un POST al registrar un nuevo joven:

```json
POST {webhook_url}
Content-Type: application/json
X-Camp-Signature: HMAC-SHA256(secret, body)

{
  "evento": "joven.registrado",
  "timestamp": "2026-02-19T10:00:00Z",
  "data": {
    "joven_nombre": "Ana García",
    "evento_nombre": "Campamento Verano 2026",
    "monitor_nombre": "Carlos López"
  }
}
```

La firma HMAC debe validarse en el receptor para autenticar el origen.

---

## Convenciones de Código

- Nombres de variables y funciones: **camelCase** (JS) / **snake_case** (SQL)
- Endpoints REST en minúsculas con guiones: `/api/admin/eventos-activos`
- Errores de API siguen el formato: `{ error: { code: "JOVEN_NOT_FOUND", message: "..." } }`
- Toda respuesta de lista incluye paginación: `{ data: [], total: 0, page: 1, limit: 20 }`
- Los timestamps siempre en UTC, formato ISO 8601

---

## Variables de Entorno Requeridas

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/campregister

# Auth
JWT_SECRET=<64+ caracteres aleatorios>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
NOTIFY_FROM=

# Almacenamiento
UPLOADS_PATH=/data/uploads   # fuera del webroot

# App
NODE_ENV=production
FRONTEND_URL=https://tudominio.com
```

---

## Referencias

- Agente general: `AGENT.md`
- Agente de seguridad: `AGENT_SECURITY.md`
