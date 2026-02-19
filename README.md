# Paroikiapp - Registro de Eventos Juveniles

Sistema completo de registro y gestión de eventos juveniles (campamentos, peregrinaciones, viajes) con autenticación segura, gestión de participantes y sistema de pagos.

## Características

- 🔐 Autenticación segura con JWT y refresh tokens en cookies httpOnly
- 📝 Registro público de participantes con enlaces únicos por monitor
- 👤 Panel de gestión para monitores
- 🏢 Panel de administración para organizadores
- 📄 Subida y gestión de documentos
- 💳 Sistema de pagos e instalments
- 📧 Notificaciones por email
- 🐳 Despliegue con Docker Compose
- 🛡️ Cumple checklist OWASP de seguridad

## Stack Tecnológico

- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: Astro (SSR)
- **Proxy**: Nginx
- **Autenticación**: JWT + Bcrypt
- **Almacenamiento**: PostgreSQL
- **Email**: Nodemailer

## Estructura del Proyecto

```
paroikiapp/
├── backend/
│   ├── src/
│   │   ├── server.js          # Entrada principal
│   │   ├── routes/            # Rutas API
│   │   ├── controllers/       # Controladores
│   │   ├── middleware/        # Middleware de seguridad
│   │   ├── models/            # BD y migraciones
│   │   ├── services/          # Servicios (notificaciones)
│   │   └── utils/             # Utilidades
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/             # Páginas Astro
│   │   ├── layouts/           # Layouts
│   │   └── components/        # Componentes
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf             # Configuración proxy
├── docker-compose.yml         # Orquestación
└── AGENT*.md                  # Documentación
```

## Inicio Rápido

### 1. Clonar el repositorio
```bash
git clone <repo-url>
cd paroikiapp
```

### 2. Configurar variables de entorno

backend/.env
```bash
DATABASE_URL=postgresql://camposter:camposter123@postgres:5432/campregister
JWT_SECRET=<generar-64-caracteres-aleatorios>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
SMTP_HOST=smtp.brevo.com
SMTP_PORT=587
SMTP_USER=tu_email@example.com
SMTP_PASS=tu_contraseña
NOTIFY_FROM="Paroikiapp <no-reply@example.com>"
NODE_ENV=production
FRONTEND_URL=http://localhost
```

### 3. Iniciar con Docker Compose
```bash
docker-compose up --build
```

La aplicación estará disponible en:
- Frontend: http://localhost
- Backend API: http://localhost/api
- PostgreSQL: localhost:5432

### 4. Crear base de datos inicial
```bash
docker-compose exec backend npm run migrate
```

## Endpoints API

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/refresh` - Refrescar token
- `POST /api/auth/logout` - Cerrar sesión
- `PATCH /api/auth/me/password` - Cambiar contraseña
- `PATCH /api/auth/me/email` - Cambiar email

### Registro Público
- `GET /register/:token` - Información del evento
- `POST /register/:token/joven` - Registrar participante
- `POST /register/:token/joven/:id/documento` - Subir documento

### Monitor
- `GET /api/monitor/jovenes` - Listar participantes
- `GET /api/monitor/jovenes/:id` - Detalle de participante
- `POST /api/monitor/pagos` - Registrar pago
- `PATCH /api/monitor/pagos/:id` - Actualizar pago

### Admin
- `GET /api/admin/eventos` - Listar eventos
- `POST /api/admin/eventos` - Crear evento
- `GET /api/admin/eventos/:id/jovenes` - Participantes por evento
- `GET /api/admin/usuarios` - Listar usuarios
- `POST /api/admin/usuarios` - Crear usuario

## Seguridad

La aplicación implementa:

✅ Hashing de contraseñas con bcrypt (min 12 rounds)  
✅ JWT con expiración corta (15 min)  
✅ Refresh tokens en cookies httpOnly  
✅ Rate limiting en endpoints públicos  
✅ Validación y sanitización de inputs  
✅ Prepared statements en todas las queries  
✅ Headers de seguridad HTTP (helmet)  
✅ CORS configurado  
✅ Validación MIME type de archivos  
✅ Almacenamiento seguro de archivos  

Ver `AGENT_SECURITY.md` para checklist completo.

## Desarrollo Local

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Migraciones de BD

```bash
npm run migrate       # Ejecutar migraciones
npm run seed          # Datos de prueba (opcional)
```

## Testing

```bash
npm test --prefix backend
```

## Logs

```bash
docker-compose logs -f backend
docker-compose logs -f postgres
```

## Variables de Entorno Principales

| Variable | Descripción | Requerido |
|----------|-----------|-----------|
| `DATABASE_URL` | Conexión PostgreSQL | ✅ |
| `JWT_SECRET` | Clave secreta (min 64 chars) | ✅ |
| `SMTP_HOST` | Servidor SMTP | ⚠️ |
| `SMTP_USER` | Usuario SMTP | ⚠️ |
| `SMTP_PASS` | Contraseña SMTP | ⚠️ |
| `NODE_ENV` | Entorno (`development`/`production`) | ✅ |

## Troubleshooting

### Error de conexión a BD
```bash
docker-compose exec postgres psql -U camposter -d campregister
```

### Limpiar volúmenes y datos
```bash
docker-compose down -v
```

### Rebuildar imágenes
```bash
docker-compose build --no-cache
```

## Licencia

Privado - Paroikiapp 2026

## Documentación Adicional

- [AGENT.md](./AGENT.md) - Guía de desarrollo
- [AGENT_SECURITY.md](./AGENT_SECURITY.md) - Checklist de seguridad
- [SKILL.md](./SKILL.md) - Esquema de BD y contratos API
