# Paroikiapp - Inicio Rápido

## 🚀 Instalación Local (Desarrollo)

### Paso 1: Requisitos
- Node.js 18+
- PostgreSQL 13+
- npm o yarn

### Paso 2: Configurar Base de Datos
```bash
# Crear usuario y BD
createuser -P camposter
createdb -O camposter campregister
```

### Paso 3: Backend
```bash
cd backend
npm install
cp .env.development .env
npm run migrate
npm run dev
```

Backend estará en `http://localhost:3001`

### Paso 4: Frontend  
En otra terminal:
```bash
cd frontend
npm install
npm run dev
```

Frontend estará en `http://localhost:3000`

### Paso 5: Datos de Prueba
```bash
cd backend
npm run seed
```

Credenciales:
- Monitor: `monitor1@example.com / password123`
- Admin: `admin@example.com / password123`

---

## 🐳 Instalación con Docker (Producción)

### Paso 1: Clonar
```bash
git clone <repo> paroikiapp
cd paroikiapp
```

### Paso 2: Configurar
```bash
cp backend/.env.example backend/.env
# Editar backend/.env con valores reales
```

Importante: Cambiar estas variables:
```bash
JWT_SECRET=<resultado-de: openssl rand -base64 48>
SMTP_HOST, SMTP_USER, SMTP_PASS
FRONTEND_URL=https://tu.dominio.com
```

### Paso 3: Iniciar
```bash
docker-compose up -d
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed  # Opcional
```

Verificar:
```bash
docker-compose ps
```

La aplicación estará en:
- http://localhost (o https://tu.dominio.com)

### Paso 4: Logs y Debugging
```bash
docker-compose logs -f backend
docker-compose logs -f postgres
```

---

## 📚 URLs Importantes

| URL | Descripción |
|-----|-----------|
| `/` | Página de inicio |
| `/login` | Panel de monitor/admin |
| `/register?token=...` | Registro público de participante |
| `/monitor` | Panel de monitor (auth requerido) |
| `/admin` | Panel de admin (auth requerido) |
| `/api/health` | Health check |

---

## 🔐 Credenciales de Prueba (Seeding)

Después de ejecutar `npm run seed`:

**Monitor 1:**
- Email: `monitor1@example.com`
- Password: `password123`
- Evento: Campamento Verano 2026

**Monitor 2:**
- Email: `monitor2@example.com`
- Password: `password123`
- Evento: Peregrinación Primavera

**Administrador:**
- Email: `admin@example.com`
- Password: `password123`

**Enlace de Registro Público:**
- Ve a `/register?token=<enlace_token_monitor>`
- (Los tokens se imprimen en el output del seed)

---

## 🛠️ Comandos Útiles

```bash
# Hace falta Make instalado (apt install make)
make help          # Ver todos los comandos
make dev           # Inicia dev mode (backend + frontend)
make dev-backend   # Solo backend
make dev-frontend  # Solo frontend
make test          # Ejecutar tests
make migrate       # Ejecutar migraciones BD
make seed          # Cargar datos de prueba
make logs          # Ver logs en vivo
make clean         # Limpiar todo (CUIDADO)
```

---

## 📖 Documentación

- **README.md** - Overview del proyecto
- **AGENT.md** - Guía de desarrollo
- **AGENT_SECURITY.md** - Checklist de seguridad
- **SKILL.md** - Schema BD y contratos API
- **DEPLOYMENT.md** - Guía de despliegue homelab

---

## ❓ Problemas Comunes

### "Cannot connect to database"
```bash
# Verificar que PostgreSQL está corriendo
psql -U camposter -d campregister

# En Docker:
docker-compose ps postgres
docker-compose logs postgres
```

### "Port 3001 already in use"
```bash
# Cambiar puerto en .env
API_PORT=3002
```

### "JWT validation failed"
- Limpiar localStorage del navegador
- Hacer login de nuevo
- Verificar que JWT_SECRET es igual en .env

### Email notifications no llegan
- Verificar SMTP_HOST, SMTP_USER, SMTP_PASS en .env
- Revisar logs: `docker-compose logs backend`
- Probar conexión SMTP manualmente

---

## 📞 Soporte

Para issues o preguntas:
1. Revisar logs: `docker-compose logs`
2. Buscar en AGENT_SECURITY.md
3. Verificar variables de entorno
4. Hacer rebuild: `docker-compose build --no-cache && docker-compose up -d`
