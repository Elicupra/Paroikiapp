# SKILL — Paroikiapp

> Versión: Iteración 1
> Esquema completo de BD, contratos de API, notificaciones y convenciones.

---

## Esquema de Base de Datos (PostgreSQL)

```sql
-- ============================================================
-- TIPOS
-- ============================================================
CREATE TYPE rol_usuario    AS ENUM ('monitor', 'organizador', 'administrador');
CREATE TYPE tipo_documento AS ENUM ('autorizacion_paterna', 'tarjeta_sanitaria');

-- ============================================================
-- TIPOS DE EVENTO (gestionable por admin)
-- ============================================================
CREATE TABLE tipos_evento (
  id     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT    NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true
);
-- Seed obligatorio:
INSERT INTO tipos_evento (nombre) VALUES ('Campamento'), ('Peregrinación'), ('Viaje');

-- ============================================================
-- USUARIOS (monitores y administradores)
-- ============================================================
CREATE TABLE usuarios (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT         UNIQUE NOT NULL,
  password_hash   TEXT         NOT NULL,
  rol             rol_usuario  NOT NULL DEFAULT 'monitor',
  nombre_mostrado TEXT         NOT NULL,
  creado_en       TIMESTAMPTZ  DEFAULT now()
  -- nombre_mostrado NO es modificable por el propio usuario
);

-- ============================================================
-- EVENTOS
-- ============================================================
CREATE TABLE eventos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT         NOT NULL,
  tipo_evento_id  UUID         REFERENCES tipos_evento(id),
  precio_base     NUMERIC(8,2) NOT NULL DEFAULT 0,
  coste_cero      BOOLEAN      NOT NULL DEFAULT false,
  descuento_global NUMERIC(8,2) DEFAULT 0,
  fecha_inicio    DATE,
  fecha_fin       DATE,
  activo          BOOLEAN      DEFAULT true,
  visible_publico BOOLEAN      DEFAULT true,  -- aparece en landing
  creado_en       TIMESTAMPTZ  DEFAULT now()
);
-- REGLA: si precio_base = 0 al crear → coste_cero = true (confirmado por admin)
-- Con coste_cero = true: no se muestran precios, no aplica lógica de pagos

-- ============================================================
-- MONITORES (relación usuario ↔ eventos asignados)
-- ============================================================
CREATE TABLE monitores (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID    REFERENCES usuarios(id) ON DELETE CASCADE,
  activo      BOOLEAN DEFAULT true
);

CREATE TABLE asignacion_eventos (
  monitor_id   UUID    REFERENCES monitores(id) ON DELETE CASCADE,
  evento_id    UUID    REFERENCES eventos(id)   ON DELETE CASCADE,
  enlace_token UUID    UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  max_jovenes  INTEGER DEFAULT NULL,  -- NULL = sin límite
  activo       BOOLEAN DEFAULT true,
  PRIMARY KEY (monitor_id, evento_id)
);
-- enlace_token: enlace de registro que el monitor comparte con sus jóvenes
-- max_jovenes: límite de jóvenes que puede gestionar ese monitor en ese evento

-- ============================================================
-- JÓVENES (participantes, sin cuenta de usuario)
-- ============================================================
CREATE TABLE jovenes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT        NOT NULL,
  apellidos     TEXT        NOT NULL,
  monitor_id    UUID        REFERENCES monitores(id)  ON DELETE RESTRICT,
  evento_id     UUID        REFERENCES eventos(id)    ON DELETE RESTRICT,
  enlace_token  UUID        UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  -- enlace_token: token personal del joven para acceder a su ficha
  ip_registro   INET,       -- IP en el momento del registro
  creado_en     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DOCUMENTOS
-- ============================================================
CREATE TABLE documentos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  joven_id        UUID         REFERENCES jovenes(id) ON DELETE CASCADE,
  tipo            tipo_documento NOT NULL,
  ruta_interna    TEXT         NOT NULL,   -- UUID filename, fuera del webroot
  nombre_original TEXT,                    -- solo para mostrar al usuario
  mime_type       TEXT         NOT NULL,
  subido_en       TIMESTAMPTZ  DEFAULT now()
);

-- ============================================================
-- PAGOS
-- ============================================================
CREATE TABLE pagos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  joven_id        UUID         REFERENCES jovenes(id)   ON DELETE CASCADE,
  plazo_numero    INTEGER      NOT NULL,
  cantidad        NUMERIC(8,2) NOT NULL,
  pagado          BOOLEAN      DEFAULT false,
  es_especial     BOOLEAN      DEFAULT false,
  nota_especial   TEXT,        -- obligatorio si es_especial = true
  descuento       NUMERIC(8,2) DEFAULT 0,
  fecha_pago      TIMESTAMPTZ,
  registrado_por  UUID         REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ  DEFAULT now()
);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
CREATE TABLE refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expira_en   TIMESTAMPTZ NOT NULL,
  creado_en   TIMESTAMPTZ DEFAULT now()
);
```

---

## Contratos de API

### Público (sin autenticación)

```
GET  /api/public/eventos          Lista eventos visibles en landing (visible_publico = true)
GET  /api/public/info             Info de la parroquia (texto estático configurable)
```

### Autenticación

```
POST   /api/auth/login            { email, password }
POST   /api/auth/refresh          Cookie: refreshToken
POST   /api/auth/logout           Cookie: refreshToken
PATCH  /api/auth/me/password      { currentPassword, newPassword }        [Auth]
PATCH  /api/auth/me/email         { password, newEmail }                  [Auth]
```

> El campo `nombre_mostrado` NO es modificable por el propio usuario.

### Registro público del joven (por token de monitor)

```
GET  /register/:monitor_token              Info del evento (nombre, tipo, fechas)
POST /register/:monitor_token/joven        { nombre, apellidos }
     → Responde: { joven_id, enlace_personal }  ← mostrar UNA SOLA VEZ
POST /register/:monitor_token/joven/:id/documento   Multipart: { tipo, file }
```

### Ficha personal del joven (por token personal del joven)

```
GET    /ficha/:joven_token                 Ver ficha (nombre, apellidos, documentos subidos)
PATCH  /ficha/:joven_token                 { nombre?, apellidos? }
POST   /ficha/:joven_token/documento       Multipart: { tipo, file }
DELETE /ficha/:joven_token/documento/:doc_id
```

### Monitor [Auth: monitor o admin]

```
GET    /api/monitor/perfil                 Info del monitor autenticado
PATCH  /api/monitor/perfil/notificaciones  { email_nuevos_jovenes: bool }

GET    /api/monitor/eventos                Eventos asignados al monitor
GET    /api/monitor/eventos/:id            Detalle del evento (solo asignados)
GET    /api/monitor/eventos/:id/recaudacion  { recaudado, esperado, por_joven[] }

GET    /api/monitor/jovenes                Jóvenes del monitor (todos sus eventos)
GET    /api/monitor/jovenes/:id            Detalle de un joven (solo propios)
PATCH  /api/monitor/jovenes/:id            { nombre?, apellidos? }
DELETE /api/monitor/jovenes/:id

POST   /api/monitor/pagos                  { joven_id, plazo_numero, cantidad, es_especial?, nota_especial? }
PATCH  /api/monitor/pagos/:id              { pagado?, cantidad?, descuento?, nota_especial? }
```

### Administrador [Auth: admin]

```
-- Tipos de evento
GET    /api/admin/tipos-evento
POST   /api/admin/tipos-evento             { nombre }
PATCH  /api/admin/tipos-evento/:id         { nombre?, activo? }
DELETE /api/admin/tipos-evento/:id

-- Eventos
GET    /api/admin/eventos
POST   /api/admin/eventos                  { nombre, tipo_evento_id, precio_base, fecha_inicio?, fecha_fin?, visible_publico? }
PATCH  /api/admin/eventos/:id              { nombre?, precio_base?, descuento_global?, activo?, visible_publico? }
DELETE /api/admin/eventos/:id
GET    /api/admin/eventos/:id/jovenes      Lista todos los jóvenes del evento
GET    /api/admin/eventos/:id/recaudacion  { total_recaudado, total_esperado, por_monitor[] }

-- Usuarios y monitores
GET    /api/admin/usuarios
POST   /api/admin/usuarios                 { email, nombre_mostrado, rol, password_temporal }
PATCH  /api/admin/usuarios/:id             { email?, nombre_mostrado?, rol?, activo? }
DELETE /api/admin/usuarios/:id

-- Asignación de eventos a monitores
GET    /api/admin/monitores/:id/eventos
POST   /api/admin/monitores/:id/eventos    { evento_id, max_jovenes? }
PATCH  /api/admin/monitores/:id/eventos/:evento_id  { max_jovenes?, activo? }
DELETE /api/admin/monitores/:id/eventos/:evento_id

-- Revocar y regenerar enlace de monitor
POST   /api/admin/monitores/:id/eventos/:evento_id/revocar-enlace
```

### Archivos adjuntos [Auth: monitor, admin o token de joven]

```
GET  /api/documentos/:id    Sirve el archivo tras validar propiedad
```

---

## Lógica de Negocio — Reglas Clave

### Precio y coste cero

```
precio_efectivo = precio_base - descuento_global
pago_especial   → registrar en pagos con es_especial = true y nota_especial obligatoria
si coste_cero   → no calcular precio_efectivo, no mostrar columna de pagos en ninguna vista
```

### Recaudación por monitor

```sql
SELECT
  m.id AS monitor_id,
  u.nombre_mostrado,
  COUNT(j.id) AS total_jovenes,
  SUM(p.cantidad) FILTER (WHERE p.pagado = true) AS recaudado,
  COUNT(j.id) * e.precio_efectivo AS esperado
FROM monitores m
JOIN usuarios u ON u.id = m.usuario_id
JOIN asignacion_eventos ae ON ae.monitor_id = m.id AND ae.evento_id = :evento_id
JOIN jovenes j ON j.monitor_id = m.id AND j.evento_id = :evento_id
LEFT JOIN pagos p ON p.joven_id = j.id
JOIN eventos e ON e.id = :evento_id
GROUP BY m.id, u.nombre_mostrado, e.precio_base, e.descuento_global;
```

### Límite de jóvenes por monitor

```
Al registrar un joven:
1. Consultar asignacion_eventos.max_jovenes para ese monitor+evento
2. Si max_jovenes IS NULL → sin límite, continuar
3. Si COUNT(jovenes donde monitor_id+evento_id) >= max_jovenes → rechazar con 403 y mensaje claro
```

---

## Sistema de Notificaciones por Email

```env
SMTP_HOST=smtp.brevo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
NOTIFY_FROM="Paroikiapp <no-reply@tudominio.com>"
```

### Eventos que disparan notificación

| Evento | Destinatario | Asunto |
|---|---|---|
| Nuevo joven registrado | Monitor | "Nuevo participante: {nombre} {apellidos}" |
| Documento adjuntado | Monitor | "Documento recibido de {nombre} {apellidos}" |

> Los emails **nunca** incluyen tokens, rutas de archivos, importes ni contraseñas.

### Webhook saliente (opcional por monitor)

```json
POST {webhook_url}
X-Paroiki-Signature: HMAC-SHA256(webhook_secret, body)

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

---

## Variables de Entorno Requeridas

```env
DATABASE_URL=postgresql://user:pass@postgres:5432/campregister
JWT_SECRET=<64+ caracteres aleatorios>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
NOTIFY_FROM=
UPLOADS_PATH=/data/uploads
NODE_ENV=production
FRONTEND_URL=https://tudominio.com
```

---

## Convenciones de Código

- Variables JS: `camelCase` · Columnas SQL: `snake_case`
- Endpoints REST en minúsculas con guiones: `/api/admin/tipos-evento`
- Errores: `{ error: { code: "JOVEN_NOT_FOUND", message: "..." } }`
- Listas paginadas: `{ data: [], total: 0, page: 1, limit: 20 }`
- Timestamps: siempre UTC, formato ISO 8601

---

## Referencias

- Agente general: `AGENT.md`
- Agente de seguridad: `AGENT_SECURITY.md`
- Historial de requerimientos: `INSTRUCTIONS.md`
