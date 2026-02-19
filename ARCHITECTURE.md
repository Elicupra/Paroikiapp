# Paroikiapp - Resumen Arquitectónico

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet / Usuarios                   │
└────────────────────────────┬────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │    Nginx SSL     │ (Puerto 80/443)
                    │  Proxy Reverso   │
                    │  Rate Limiting   │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼────────┐  ┌───▼──────────┐  ┌─▼─────────────┐
    │ Frontend Astro │  │ Backend API  │  │  PostgreSQL   │
    │  (SSR)         │  │  (Express)   │  │   (BD)        │
    │  Port 3000     │  │  Port 3001   │  │  Port 5432    │
    └────────────────┘  └──────┬───────┘  └───────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                ┌───▼──────────┐    ┌──────▼────────┐
                │ Notificaciones│    │ Almacenamiento│
                │  (Email SMTP) │    │   de Archivos │
                └────────────────┘    └───────────────┘
```

## Flujo de Autenticación

```
Usuario (Monitor/Admin)
    │
    └─► POST /api/auth/login { email, password }
        │
        └─► Backend valida email + bcrypt password
            │
            ├─► Genera JWT (15 min) en response
            └─► Guarda refresh token hash en BD
                (7 días)

                ↓

Frontend almacena:
    • accessToken en memory/sessionStorage
    • refreshToken en cookie httpOnly

                ↓

Requests posteriores:
    Authorization: Bearer <accessToken>
    (Cookie httpOnly se envía automáticamente)

                ↓

Cuando JWT expira:
    POST /api/auth/refresh
    (Con refresh token en cookie)
    
    └─► Nuevo JWT (15 min)
```

## Flujo de Registro Público (Sin Autenticación)

```
Joven Participante
    │
    └─► GET /register/:token
        │
        └─► Obtiene info del evento sin autenticarse
            └─► Monitor nombre, evento, fechas

                ↓

            POST /register/:token/joven
            Body: { nombre, apellidos }
            │
            └─► Backend valida token del monitor
                ├─► Verifica que monitor existe en BD
                ├─► Crea nuevo registro en jovenes
                └─► Envía email al monitor

                ↓

            (Opcional) Subida de documentos
            POST /register/:token/joven/:jovenId/documento
            Multipart: { tipo, file }
```

## Estructura de Roles y Permisos

```
┌─────────────────────────────────────────────────────────┐
│                    Joven Participante                    │
│  • Ver su propio registro (vía token único)              │
│  • Subir documentos (autorizaciones, tarjeta sanitaria)  │
│  • Ver información del evento                            │
│  • NO puede ver otros registros                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                        Monitor                           │
│  • Listar jóvenes de su propio grupo                     │
│  • Ver detalles de jóvenes (documentos, pagos)           │
│  • Registrar y actualizar pagos                          │
│  • NO puede ver otros grupos                             │
│  • NO puede crear eventos ni usuarios                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Organizador (Admin)                   │
│  • Crear/editar eventos                                  │
│  • Crear usuarios (monitores, organizadores)             │
│  • Ver todos los eventos y jóvenes                       │
│  • Revocar/regenerar enlaces de monitores                │
│  • Ver reportes globales                                 │
└─────────────────────────────────────────────────────────┘
```

## Medidas de Seguridad Implementadas

```
Autenticación:
    ✅ Contraseñas: bcryptjs (12 rounds)
    ✅ JWT: Firma HMAC-SHA256, expira en 15min
    ✅ Refresh tokens: Hash SHA256 en BD, validación active
    ✅ Logout: Invalidación de todos los refresh tokens

Autorización:
    ✅ Middleware authMiddleware en rutas protegidas
    ✅ Validación de rol (monitor vs organizador)
    ✅ Verificación ownership (e.g., monitor solo su grupo)

SQL Injection:
    ✅ Prepared statements (pg library parametrizado)
    ✅ Express-validator para sanitización
    ✅ NUNCA concatenación de strings en SQL

Subida de Archivos:
    ✅ Validación MIME type real (librería file-type)
    ✅ Límite 5MB por archivo
    ✅ Renombrado con UUID (aleatorio)
    ✅ Almacenamiento fuera del webroot
    ✅ Validación ownership en descarga

Rate Limiting:
    ✅ General: 100 req/15 min por IP
    ✅ Login: 5 intentos/15 min por IP
    ✅ Implementado con express-rate-limit

HTTP Headers:
    ✅ Helmet: CSP, HSTS, X-Frame-Options, X-XSS-Protection
    ✅ CORS: Explícito (no wildcard)
    ✅ X-Forwarded-* headers validados en Nginx

Errores:
    ✅ No revelar info de BD en mensajes
    ✅ Login: No distinguir "usuario no existe" vs "contraseña incorrecta"
    ✅ Stack traces solo en desarrollo

Secrets:
    ✅ .env en .gitignore
    ✅ JWT_SECRET: Min 64 caracteres aleatorios
    ✅ SMTP credentials: Solo en .env
    ✅ Nunca en código fuente
```

## Base de Datos - Schema Relacional

```
usuarios (1) ──────► (M) monitores (M) ──────► (M) jovenes
    │                     │                        │
    │ password_hash       │ evento_id              │ monitor_id
    ├─ id                 │                        │ evento_id
    ├─ email (UNIQUE)     └─────────────────┐     │
    ├─ rol                                  │     │
    ├─ nombre_mostrado                      │     ├─► (M) documentos
    └─ activo                               │     │        ├─ tipo (enum)
                                            │     │        └─ ruta_interna (UUID)
                                            │     │
                    eventos <─────────────┘     ├─► (M) pagos
                        │                            ├─ plazo_numero
                        ├─ id                        ├─ cantidad
                        ├─ tipo (enum)               ├─ es_especial
                        ├─ precio_base               └─ fecha_pago
                        ├─ fecha_inicio
                        └─ fecha_fin

refresh_tokens
    ├─ id
    ├─ usuario_id ─────────► usuarios(id)
    ├─ refresh_token_hash
    ├─ expira_en
    └─ activo
```

## Endpoints Organizados por Rol

```
SIN AUTENTICACIÓN
  GET    /register/:token                 # Info del evento
  POST   /register/:token/joven            # Crear participante
  POST   /register/:token/joven/:id/doc    # Subir documento

AUTENTICACIÓN (token JWT en Authorization header)
  POST   /api/auth/login                  # → JWT + refresh token
  POST   /api/auth/refresh                # (refresh token en cookie)
  POST   /api/auth/logout
  PATCH  /api/auth/me/password
  PATCH  /api/auth/me/email
  GET    /health                          # Health check

MONITOR (rol == 'monitor')
  GET    /api/monitor/jovenes             # Listar propios
  GET    /api/monitor/jovenes/:id         # Detalle
  POST   /api/monitor/pagos               # Crear pago
  PATCH  /api/monitor/pagos/:id           # Actualizar pago
  GET    /api/documentos/:id              # Descargar archivo

ORGANIZADOR (rol == 'organizador')
  GET    /api/admin/eventos               # Listar
  POST   /api/admin/eventos               # Crear
  GET    /api/admin/eventos/:id/jovenes   # Por evento
  GET    /api/admin/usuarios              # Listar
  POST   /api/admin/usuarios              # Crear usuario
  DELETE /api/admin/monitores/:id/token   # Revocar enlace
```

## Notificaciones Email

```
Eventos que disparan email:

1. Nuevo Joven Registrado
   Destinatario: monitor@email.com
   Evento: POST /register/:token/joven
   Template: "Nuevo participante: {nombre}"
   
2. Documento Adjuntado
   Destinatario: monitor@email.com
   Evento: POST /register/:token/joven/:id/documento
   Template: "Documento recibido: {tipo} de {nombre}"
   
3. Cambio de Contraseña
   Destinatario: usuario@email.com
   Evento: PATCH /api/auth/me/password
   Template: "Tu contraseña ha sido cambiada"

Provider: Nodemailer → SMTP externo (Brevo, Resend, etc.)
```

## Despliegue en Capas

```
┌─────────────────────────────────────────────────────────┐
│ Capa 1: Cliente (Navegador)                             │
│  • HTML/CSS/JavaScript (SSR con Astro)                  │
│  • Token storage: memory + httpOnly cookies             │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Capa 2: Proxy Reverso (Nginx)                           │
│  • Termina SSL/TLS                                      │
│  • Rate limiting                                        │
│  • Compresión gzip                                      │
│  • Headers de seguridad                                 │
│  • Redirección de rutas                                 │
└──────────────────┬──────────────────────────────────────┘
              ┌────┴────┐
              │          │
┌─────────────▼────┐  ┌──▼────────────────┐
│ Capa 3a: API     │  │ Capa 3b: Frontend  │
│ Backend (Express)│  │ (Astro SSR)        │
│  • JWT validation│  │  • Server-side     │
│  • DB queries    │  │    rendering       │
│  • Email service │  │  • Protected pages │
│  • File upload   │  │  • Public pages    │
└────────┬─────────┘  └────────────────────┘
         │
┌────────▼──────────────────────────────────┐
│ Capa 4: Base de Datos (PostgreSQL)        │
│  • Prepared statements                    │
│  • Transacciones ACID                     │
│  • Índices optimizados                    │
│  • Backups diarios                        │
└───────────────────────────────────────────┘

Storage Distribuido:
  └─► /data/uploads/ (fuera del webroot)
      ├─ joven-uuid-1/documento.pdf
      ├─ joven-uuid-2/tarjeta.png
      └─ ...
```

## Variables de Entorno Críticas

```
DATABASE_URL        - Conexión PostgreSQL (CRÍTICA)
JWT_SECRET          - Min 64 chars aleatorios (CRÍTICA)
SMTP_HOST/USER/PASS - Para notificaciones por email
FRONTEND_URL        - URL de acceso (para CORS)
NODE_ENV            - development/production
UPLOADS_PATH        - Directorio de almacenamiento
```

## Escalabilidad Futura

```
Horizontal (Múltiples instancias backend):
  • Load balancer en Nginx
  • Session store en Redis
  • Database connection pooling

Vertical (Más recursos):
  • Aumentar memoria Docker
  • Aumentar workers PostgreSQL
  • Cache con Redis

Monitoreo:
  • Prometheus + Grafana
  • ELK stack para logs
  • Sentry para errores
  • Datadog o New Relic
```

---

## Referencias Rápidas

- AGENT.md: Flujo de trabajo desarrollo
- AGENT_SECURITY.md: Checklist seguridad
- SKILL.md: Schema BD completo
- DEPLOYMENT.md: Instrucciones homelab
- QUICKSTART.md: Inicio en 5 minutos
