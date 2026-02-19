# Paroikiapp - Estructura de Ficheros Completa

Resumen de la estructura del proyecto y descripción de cada fichero.

## Raíz del Proyecto

```
paroikiapp/
├── .gitignore              - Archivos ignorados por git
├── .env.example            - Template de variables de entorno (NO USAR DIRECTAMENTE)
├── Makefile                - Comandos útiles (make dev, make test, etc.)
├── docker-compose.yml      - Orquestación de servicios (BD, backend, frontend, nginx)
├── README.md               - Overview general del proyecto
├── QUICKSTART.md           - Guía de inicio rápido (5 minutos)
├── AGENT.md                - Responsabilidades del agente desarrollador
├── AGENT_SECURITY.md       - Checklist de auditoría de seguridad
├── SKILL.md                - Schema BD, contratos API, convenciones
├── ARCHITECTURE.md         - Diagrama arquitectónico y diseño general
├── DEPLOYMENT.md           - Guía homelab con Docker, SSL, monitoreo
├── CHANGELOG.md            - Historial de versiones
└── fail2ban/
    └── jail.local          - Configuración Fail2Ban (seguridad)
```

## Backend (Express + Node.js)

```
backend/
├── package.json            - Dependencias npm (express, pg, bcryptjs, etc.)
├── Dockerfile              - Imagen Docker para producción
├── nodemon.json            - Configuración hot-reload desarrollo
├── .env.example            - Variables de entorno de ejemplo
├── .env.development        - Variables para desarrollo local
├── jest.config.js          - Configuración testing
│
├── src/
│   ├── server.js           - Punto de entrada (express, middleware, rutas)
│   │
│   ├── routes/             - Definición de endpoints
│   │   ├── auth.js         - Autenticación (login, logout, refresh, etc.)
│   │   ├── register.js     - Registro público de participantes
│   │   ├── monitor.js      - Panel de monitor (listar jóvenes, pagos)
│   │   ├── admin.js        - Panel de admin (eventos, usuarios)
│   │   └── documents.js    - Descarga de archivos
│   │
│   ├── controllers/        - Lógica de negocio
│   │   ├── authController.js
│   │   ├── registerController.js
│   │   ├── monitorController.js
│   │   ├── adminController.js
│   │   └── documentController.js
│   │
│   ├── middleware/         - Funciones intermedias
│   │   ├── auth.js         - JWT verification & role checking
│   │   ├── validators.js   - Input validation (express-validator)
│   │   ├── rateLimiters.js - Rate limiting por endpoint
│   │   └── errorHandler.js - Error handling & logging
│   │
│   ├── models/             - Base de datos
│   │   ├── db.js           - Pool de conexiones PostgreSQL
│   │   ├── migrate.js      - SQL schema (tipos, tablas, índices)
│   │   └── seed.js         - Datos de prueba (monitores, eventos, etc.)
│   │
│   ├── services/           - Servicios externos
│   │   └── notifications.js - Email notifications (Nodemailer)
│   │
│   └── utils/              - Funciones auxiliares
│       └── crypto.js       - Bcrypt, JWT, UUID, hashing
│
└── tests/                  - Unit tests (opcional)
    └── auth.test.js
```

## Frontend (Astro)

```
frontend/
├── package.json            - Dependencias npm (astro, node adapter)
├── Dockerfile              - Imagen Docker (builder + runtime)
├── astro.config.mjs        - Configuración Astro (SSR, puerto, vite)
│
└── src/
    ├── pages/              - Rutas y páginas (Astro routing)
    │   ├── index.astro     - Home / Inicio
    │   ├── login.astro     - Login para monitores/admin
    │   ├── register.astro  - Registro público de participante
    │   ├── monitor.astro   - Panel de monitor (protegido)
    │   └── admin.astro     - Panel de admin (protegido)
    │
    ├── layouts/            - Plantillas reutilizables
    │   └── Layout.astro    - Layout principal (nav, estilos base)
    │
    └── components/         - Componentes de UI (pendiente)
        ├── Header.astro    - (pronto)
        ├── Footer.astro    - (pronto)
        └── ...
```

## Nginx

```
nginx/
├── nginx.conf              - Configuración principal
│                             • SSL/TLS
│                             • Rate limiting
│                             • Headers de seguridad
│                             • Proxy a backend/frontend
│                             • Compresión gzip
│
├── conf.d/                 - Configuraciones adicionales (pronto)
│   └── ssl-params.conf     - (pronto)
│
└── certs/                  - Certificados SSL (auto-firmados o Let's Encrypt)
    ├── certificate.crt
    └── private.key
```

## Documentación

```
docs/                       - (Opcional) Docs más detalladas
├── API.md                  - Referencia completa de endpoints
├── SECURITY.md             - Mejores prácticas de seguridad
├── DEVELOPMENT.md          - Workflow de desarrollo
└── DATABASE.md             - Schema y queries útiles
```

---

## Estadísticas del Proyecto

```
Backend:
  • Controllers: 5 (auth, register, monitor, admin, document)
  • Routes: 20+ endpoints
  • Middleware: 4 (auth, validators, rateLimiters, errorHandler)
  • Services: 1 (notifications)
  • Utils: 1 (crypto - hashing, JWT, validación)

Frontend:
  • Pages: 5 (index, login, register, monitor, admin)
  • Layouts: 1 (principal con nav y estilos)
  • Features: Fetch con async/await, localStorage, CORS

BD:
  • Types: 3 enums (tipo_evento, rol_usuario, tipo_documento)
  • Tables: 7 (usuarios, monitores, eventos, jovenes, documentos, pagos, refresh_tokens)
  • Indices: 8 (optimizados para queries frecuentes)
  • Relaciones: 1-M y M-M con integridad referencial

Total de ficheros: ~50
Total de líneas de código: ~3500+
```

---

## Map de Dependencias Clave

```
express.js
  ├─ helmet (seguridad)
  ├─ cors (CORS)
  ├─ express-validator (validación)
  ├─ express-rate-limit (throttling)
  │
  ├─ pg (PostgreSQL)
  ├─ bcryptjs (hashing contraseñas)
  ├─ jsonwebtoken (JWT)
  ├─ multer (subida archivos - no implementado aún en rutas)
  ├─ file-type (validación MIME real)
  ├─ nodemailer (email)
  └─ uuid (generación UUID)

astro
  ├─ @astrojs/node (adapter SSR)
  └─ TypeScript (opcional)

nginx
  └─ Módulos nativos (ssl, gzip, rate limiting)

docker
  └─ postgres:15-alpine
  └─ node:18-alpine
```

---

## Convenciones de Código

- **Backend (JS):** camelCase para variables/funciones
- **BD (SQL):** snake_case para columnas/tablas
- **URLs:** minúsculas con guiones (REST conventions)
- **Respuestas:** JSON con estructura: `{ data, error, total, page }`
- **Errores:** `{ error: { code: "ERROR_CODE", message: "..." } }`

---

## Próximos Pasos (TODO)

- [ ] Multer middleware para subida de documentos
- [ ] Tests unitarios + E2E
- [ ] Validación de email (verificación doble opt-in)
- [ ] Webhooks para monitores
- [ ] Dashboard analítico
- [ ] Backups automáticos PostgreSQL
- [ ] Certificados SSL Let's Encrypt
- [ ] Monitoreo (Prometheus/Grafana)
- [ ] CI/CD (GitHub Actions)
- [ ] Documentación API (Swagger/OpenAPI)

---

## Cómo Usar Este Documento

1. **Desarrollo:** Busca en la sección Backend/Frontend para entender la estructura
2. **Deployment:** Ve a DEPLOYMENT.md para instrucciones homelab
3. **Seguridad:** Revisa AGENT_SECURITY.md para checklist
4. **APIs:** Consulta SKILL.md para contratos de endpoints
5. **Arquitectura:** Lee ARCHITECTURE.md para diagramas
