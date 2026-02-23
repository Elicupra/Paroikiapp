# SKILL — Paroikiapp

> Versión: Iteración 2
> Esquema completo de BD, contratos de API, lógica de negocio y convenciones.

---

## Esquema de Base de Datos (PostgreSQL)

> Schema: `paroikiapp` (configurado en `DB_SCHEMA` del `.env`)

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
-- Seed: INSERT INTO tipos_evento (nombre) VALUES ('Campamento'), ('Peregrinación'), ('Viaje');

-- ============================================================
-- USUARIOS
-- ============================================================
CREATE TABLE usuarios (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        UNIQUE NOT NULL,
  password_hash   TEXT        NOT NULL,
  rol             rol_usuario NOT NULL DEFAULT 'monitor',
  nombre_mostrado TEXT        NOT NULL,
  activo          BOOLEAN     DEFAULT true,
  creado_en       TIMESTAMPTZ DEFAULT now()
);
-- nombre_mostrado: modificable por el propio usuario desde su perfil (diferente de nombre_usuario)
-- El nombre de usuario como identificador único NO existe; se usa email

-- ============================================================
-- EVENTOS
-- ============================================================
CREATE TABLE eventos (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT         NOT NULL,
  tipo_evento_id   UUID         REFERENCES tipos_evento(id),
  tipo             TEXT,                       -- campo legado, mantener por compatibilidad
  precio_base      NUMERIC(8,2) NOT NULL DEFAULT 0,
  coste_cero       BOOLEAN      NOT NULL DEFAULT false,
  descuento_global NUMERIC(8,2) DEFAULT 0,
  fecha_inicio     DATE,
  fecha_fin        DATE,
  activo           BOOLEAN      DEFAULT true,
  visible_publico  BOOLEAN      DEFAULT true,  -- aparece en landing y /eventos público
  descripcion      TEXT,
  creado_en        TIMESTAMPTZ  DEFAULT now()
);
-- REGLA: si precio_base = 0 al crear → coste_cero debe confirmarse con campo confirmar_coste_cero: true

-- ============================================================
-- MONITORES
-- ============================================================
CREATE TABLE monitores (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID    REFERENCES usuarios(id) ON DELETE CASCADE,
  activo     BOOLEAN DEFAULT true
);

CREATE TABLE asignacion_eventos (
  monitor_id   UUID    REFERENCES monitores(id) ON DELETE CASCADE,
  evento_id    UUID    REFERENCES eventos(id)   ON DELETE CASCADE,
  enlace_token UUID    UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  max_jovenes  INTEGER DEFAULT NULL,
  activo       BOOLEAN DEFAULT true,
  PRIMARY KEY (monitor_id, evento_id)
);

-- ============================================================
-- JÓVENES
-- ============================================================
CREATE TABLE jovenes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT        NOT NULL,
  apellidos     TEXT        NOT NULL,
  monitor_id    UUID        REFERENCES monitores(id)  ON DELETE RESTRICT,
  evento_id     UUID        REFERENCES eventos(id)    ON DELETE RESTRICT,
  enlace_token  UUID        UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  ip_registro   INET,
  creado_en     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DOCUMENTOS DE JÓVENES
-- ============================================================
CREATE TABLE documentos (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  joven_id        UUID           REFERENCES jovenes(id) ON DELETE CASCADE,
  tipo            tipo_documento NOT NULL,
  ruta_interna    TEXT           NOT NULL,
  nombre_original TEXT,
  mime_type       TEXT           NOT NULL,
  validado        BOOLEAN        DEFAULT false,
  subido_en       TIMESTAMPTZ    DEFAULT now()
);

-- ============================================================
-- PAGOS
-- ============================================================
CREATE TABLE pagos (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  joven_id       UUID         REFERENCES jovenes(id) ON DELETE CASCADE,
  plazo_numero   INTEGER      NOT NULL,
  cantidad       NUMERIC(8,2) NOT NULL,
  pagado         BOOLEAN      DEFAULT false,
  es_especial    BOOLEAN      DEFAULT false,
  nota_especial  TEXT,
  descuento      NUMERIC(8,2) DEFAULT 0,
  fecha_pago     TIMESTAMPTZ,
  registrado_por UUID         REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  DEFAULT now()
);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
CREATE TABLE refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID        REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expira_en  TIMESTAMPTZ NOT NULL,
  creado_en  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CONFIGURACIÓN GLOBAL (NUEVO — Iteración 2)
-- ============================================================
CREATE TABLE configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  tipo  TEXT DEFAULT 'texto'  -- 'texto', 'color', 'imagen', 'booleano'
);
-- Seed obligatorio:
INSERT INTO configuracion VALUES
  ('app_nombre',         'Paroikiapp',                    'texto'),
  ('parroquia_nombre',   'Parroquia San Miguel',           'texto'),
  ('parroquia_texto',    'Bienvenidos a nuestra parroquia. Aquí encontrarás información sobre nuestros eventos y actividades para jóvenes de nuestra comunidad.', 'texto'),
  ('parroquia_logo',     '',                               'imagen'),
  ('color_primario',     '#2563eb',                        'color'),
  ('color_secundario',   '#1e40af',                        'color'),
  ('color_acento',       '#f59e0b',                        'color'),
  ('contacto_email',     '',                               'texto'),
  ('contacto_telefono',  '',                               'texto'),
  ('contacto_direccion', '',                               'texto');

-- ============================================================
-- FICHEROS PRIVADOS DE MONITOR (NUEVO — Iteración 2)
-- ============================================================
CREATE TABLE monitor_ficheros (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id      UUID        REFERENCES monitores(id) ON DELETE CASCADE,
  ruta_interna    TEXT        NOT NULL,
  nombre_original TEXT,
  mime_type       TEXT        NOT NULL,
  subido_en       TIMESTAMPTZ DEFAULT now()
);
```

---

## Contratos de API

### Público (sin autenticación)

```
GET  /api/public/eventos
     → [{ id, nombre, tipo, fecha_inicio, fecha_fin, descripcion }]
     Solo eventos con activo=true y visible_publico=true

POST /api/public/contacto
     Body: { nombre, email, asunto, mensaje }
     → 200 { ok: true }
     Envía email a contacto_email de configuración
```

### Autenticación

```
POST   /api/auth/login
       Body: { email, password }
       → { token } + cookie refreshToken httpOnly

POST   /api/auth/refresh          (cookie refreshToken)
       → { token }

POST   /api/auth/logout           (cookie refreshToken)
       → 200

PATCH  /api/auth/me/profile       [Auth]
       Body: { nombre_mostrado }
       → 200 { usuario }

PATCH  /api/auth/me/email         [Auth]
       Body: { password, newEmail }
       → 200

PATCH  /api/auth/me/password      [Auth]
       Body: { currentPassword, newPassword }
       → 200 (invalida todos los refresh tokens)
```

### Registro público del joven

```
GET  /register/:token
     → { evento: { nombre, tipo, fecha_inicio, fecha_fin } }
     Resuelve desde asignacion_eventos.enlace_token

POST /register/:token/joven
     Body: { nombre, apellidos }
     → 201 { joven_id, enlace_personal }
     enlace_personal = URL completa a /ficha/:joven_token (mostrar UNA SOLA VEZ)

POST /register/:token/joven/:jovenId/documento
     Multipart: { tipo, file }
     → 201 { documento_id }
```

### Ficha personal del joven

```
GET    /ficha/:jovenToken          → { nombre, apellidos, documentos[] }
GET    /register/acceso/:accessToken  (alias, mismo comportamiento)

PATCH  /ficha/:jovenToken
       Body: { nombre?, apellidos? }
       → 200 { joven }

POST   /ficha/:jovenToken/documento
       Multipart: { tipo, file }
       → 201

DELETE /ficha/:jovenToken/documento/:docId
       → 200
```

### Monitor [Auth: monitor o admin]

```
GET  /api/monitor/eventos
     → [{ id, nombre, tipo, fecha_inicio, max_jovenes, enlace_token, jovenes_count }]

GET  /api/monitor/eventos/:eventoId/recaudacion
     → { recaudado, esperado, por_joven: [{ joven_id, nombre, pagado, esperado }] }

GET  /api/monitor/resumen?evento_id=:id
     → { jovenes_count, recaudado, esperado, max_jovenes }

GET  /api/monitor/registration-link
     → { url }  (enlace de registro del monitor para el evento activo/seleccionado)

GET  /api/monitor/jovenes?evento_id=:id
     → [{ id, nombre, apellidos, documentos_count, pagos_count, creado_en }]

GET  /api/monitor/jovenes/:jovenId
     → { joven, documentos[], pagos[] }

PATCH /api/monitor/jovenes/:jovenId
      Body: { nombre?, apellidos? }
      → 200

GET  /api/monitor/jovenes/:jovenId/documentos
     → [{ id, tipo, nombre_original, validado, subido_en }]

PATCH /api/monitor/documentos/:docId/validar
      Body: { validado: bool }
      → 200

POST  /api/monitor/pagos
      Body: { joven_id, plazo_numero, cantidad, es_especial?, nota_especial? }
      → 201
      REGLA: si es_especial=true → nota_especial es obligatoria

PATCH /api/monitor/pagos/:pagoId
      Body: { pagado?, cantidad?, descuento?, nota_especial? }
      → 200

-- Ficheros propios del monitor (NUEVO — Iteración 2)
GET    /api/monitor/ficheros
       → [{ id, nombre_original, mime_type, subido_en }]

POST   /api/monitor/ficheros
       Multipart: { file }
       → 201 { fichero_id }

DELETE /api/monitor/ficheros/:ficheroId
       → 200
```

### Administrador [Auth: admin]

```
-- Dashboard (NUEVO)
GET  /api/admin/dashboard
     → { total_eventos, total_monitores, total_jovenes, recaudacion_global }

-- Tipos de evento
GET    /api/admin/tipos-evento
POST   /api/admin/tipos-evento        { nombre }
PATCH  /api/admin/tipos-evento/:id    { nombre?, activo? }
DELETE /api/admin/tipos-evento/:id

-- Eventos
GET    /api/admin/eventos
POST   /api/admin/eventos             { nombre, tipo_evento_id, precio_base, confirmar_coste_cero?, fecha_inicio?, fecha_fin?, descripcion?, visible_publico? }
GET    /api/admin/eventos/:eventoId
PUT    /api/admin/eventos/:eventoId
DELETE /api/admin/eventos/:eventoId
PATCH  /api/admin/eventos/:eventoId/descuento-global   { descuento_global }
GET    /api/admin/eventos/:eventoId/recaudacion
       → { total_recaudado, total_esperado, por_monitor: [{ monitor_id, nombre, recaudado, esperado, total_jovenes }] }

-- Usuarios
GET    /api/admin/usuarios
POST   /api/admin/usuarios            { email, nombre_mostrado, rol, password_temporal }
GET    /api/admin/usuarios/:usuarioId
PUT    /api/admin/usuarios/:usuarioId
PATCH  /api/admin/usuarios/:usuarioId/toggle-active
DELETE /api/admin/usuarios/:usuarioId
GET    /api/admin/usuarios/:usuarioId/eventos

-- Monitores y asignaciones
POST   /api/admin/monitores
DELETE /api/admin/monitores/:monitorId
GET    /api/admin/monitores/:monitorId/eventos
POST   /api/admin/monitores/:monitorId/eventos         { evento_id, max_jovenes? }
PATCH  /api/admin/monitores/:monitorId/eventos/:eventoId  { max_jovenes?, activo? }
DELETE /api/admin/monitores/:monitorId/eventos/:eventoId
POST   /api/admin/monitores/:monitorId/eventos/:eventoId/revocar-enlace
PATCH  /api/admin/monitores/:monitorId/max-jovenes     { max_jovenes }
GET    /api/admin/monitores/:monitorId/dashboard       → { eventos[], jovenes_por_evento[], recaudacion }  (NUEVO)
GET    /api/admin/monitores/:monitorId/ficheros        (NUEVO)

-- Jóvenes
GET    /api/admin/jovenes
POST   /api/admin/jovenes             { nombre, apellidos, monitor_id, evento_id }
PATCH  /api/admin/jovenes/:jovenId
DELETE /api/admin/jovenes/:jovenId
GET    /api/admin/jovenes/:jovenId/perfil   → { joven, documentos[], pagos[] }

-- Configuración global (NUEVO)
GET    /api/admin/configuracion
       → [{ clave, valor, tipo }]

PUT    /api/admin/configuracion
       Body: [{ clave, valor }]  (batch update)
       → 200

-- Documentos (descarga autenticada)
GET    /api/documentos/:docId         Sirve el archivo validando propiedad
```

---

## Lógica de Negocio

### Precio efectivo

```
precio_efectivo = precio_base - descuento_global
Si coste_cero = true → no calcular, no mostrar en ninguna vista
Si es_especial = true en un pago → nota_especial es obligatoria
```

### Recaudación por monitor

```sql
SELECT
  u.nombre_mostrado,
  COUNT(j.id)                                           AS total_jovenes,
  COALESCE(SUM(p.cantidad) FILTER (WHERE p.pagado), 0) AS recaudado,
  COUNT(j.id) * (e.precio_base - e.descuento_global)   AS esperado
FROM monitores m
JOIN usuarios u            ON u.id = m.usuario_id
JOIN asignacion_eventos ae ON ae.monitor_id = m.id AND ae.evento_id = $1
JOIN jovenes j             ON j.monitor_id = m.id AND j.evento_id = $1
LEFT JOIN pagos p          ON p.joven_id = j.id
JOIN eventos e             ON e.id = $1
GROUP BY m.id, u.nombre_mostrado, e.precio_base, e.descuento_global;
```

### Límite de jóvenes por monitor

```
Al registrar un joven:
1. Leer asignacion_eventos.max_jovenes para ese monitor+evento
2. Si NULL → sin límite, continuar
3. Si COUNT(jovenes) >= max_jovenes → 403 "El grupo de este monitor está completo"
```

### Configuración dinámica (CSS variables)

El Layout.astro lee `/api/admin/configuracion` (o un endpoint público equivalente) en tiempo de build/SSR y genera:

```css
:root {
  --color-primario:    [valor de color_primario];
  --color-secundario:  [valor de color_secundario];
  --color-acento:      [valor de color_acento];
}
```

El nombre de la app y logo también se inyectan desde esta tabla.

---

## Sistema de Notificaciones

```env
SMTP_HOST=smtp.brevo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
NOTIFY_FROM="Paroikiapp <no-reply@tudominio.com>"
```

| Evento | Destinatario | Asunto |
|---|---|---|
| Nuevo joven registrado | Monitor | "Nuevo participante: {nombre} {apellidos}" |
| Documento adjuntado | Monitor | "Documento recibido de {nombre}" |
| Formulario de contacto | Admin (contacto_email) | "Contacto: {asunto}" |

Los emails **nunca** incluyen tokens, rutas de archivos, importes ni contraseñas.

---

## Variables de Entorno

```env
# Base de datos
DATABASE_URL=postgresql://camposter:camposter123@postgres:5432/campregister
DB_SCHEMA=paroikiapp

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
UPLOADS_PATH=/data/uploads

# App
NODE_ENV=production
FRONTEND_URL=https://tudominio.com

# Frontend (Astro public)
PUBLIC_API_URL=http://localhost/api
```

---

## Convenciones de Código

- Variables JS: `camelCase` · Columnas SQL: `snake_case`
- Endpoints REST: minúsculas con guiones `/api/admin/tipos-evento`
- Errores: `{ error: { code: "SNAKE_CASE", message: "Descripción legible" } }`
- Listas paginadas: `{ data: [], total: 0, page: 1, limit: 20 }`
- Timestamps: UTC, ISO 8601
- Nunca URL hardcodeada en frontend; siempre `import.meta.env.PUBLIC_API_URL`

---

## Referencias

- Agente general: `AGENT.md`
- Agente de seguridad: `AGENT_SECURITY.md`
- Requerimientos: `INSTRUCTIONS.md`
- Historial: `CHANGELOG.md`
