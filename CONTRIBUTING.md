# Paroikiapp - Guía de Contribución

Instrucciones para colaborar en el desarrollo de Paroikiapp respetando los estándares de seguridad y arquitectura.

## Pre-requisitos

- Node.js 18+
- PostgreSQL 13+
- Git
- npm o yarn
- Familiaridad con Express y Astro

## Configuración Inicial

### 1. Clonar y prepare ambiente
```bash
git clone <repo-url>
cd paroikiapp

# Backend
cd backend
npm install
cp .env.development .env
npm run migrate

# Frontend
cd ../frontend
npm install

cd ..
```

### 2. Levantar en desarrollo
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3 (opcional): Logs
docker-compose logs -f postgres
```

### 3. Cargar datos de prueba
```bash
cd backend
npm run seed
```

## Flujo de Trabajo

### Antes de Escribir Código

1. **Lee la documentación relevante:**
   - AGENT.md - Requerimientos generales
   - AGENT_SECURITY.md - Checklist de seguridad
   - SKILL.md - Schema BD y contratos API
   - ARCHITECTURE.md - Cómo encaja tu cambio

2. **Identifica el módulo afectado:**
   - ¿Es una ruta nueva? → `backend/src/routes/`
   - ¿Es validación? → `backend/src/middleware/validators.js`
   - ¿Es seguridad? → `backend/src/middleware/auth.js`
   - ¿Es una página? → `frontend/src/pages/`
   - ¿Es un componente? → `frontend/src/components/`

3. **Planifica tu cambio:**
   - ¿Afecta la BD? → Planifica migración en `backend/src/models/migrate.js`
   - ¿Necesita endpoint? → Agrega a `SKILL.md` primero
   - ¿Es público o privado? → Considera autenticación/autorización

### Escribiendo Código Backend

#### Crear un Nuevo Endpoint

1. **Agregar ruta en `backend/src/routes/`:**
```javascript
// routes/ejemplo.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { someValidator } = require('../middleware/validators');
const exampleController = require('../controllers/exampleController');

router.post('/crear', authMiddleware, someValidator, exampleController.create);
module.exports = router;
```

2. **Crear controlador en `backend/src/controllers/`:**
```javascript
// controllers/exampleController.js
const pool = require('../models/db');

const create = async (req, res, next) => {
  try {
    const { field1, field2 } = req.body;

    // Validación adicional si es necesaria
    if (!field1) {
      return res.status(400).json({
        error: {
          code: 'INVALID_FIELD',
          message: 'field1 is required',
        },
      });
    }

    // Query SIEMPRE parametrizada
    const result = await pool.query(
      'INSERT INTO tabla (col1, col2) VALUES ($1, $2) RETURNING *',
      [field1, field2]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err); // Pasar al errorHandler
  }
};

module.exports = { create };
```

3. **Agregar validación en `backend/src/middleware/validators.js`:**
```javascript
const validateExample = [
  body('field1')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('field1 must be 1-100 chars'),
  body('field2')
    .isInt()
    .withMessage('field2 must be an integer'),
  validate,
];
```

4. **Documentar en `SKILL.md`:**
```
POST /api/example/crear    Body: { field1, field2 }   [Auth]
```

#### Seguridad - Checklist

Antes de hacer commit, verifica:

- [ ] **SQL:** Todas las queries usan `$1, $2` (parametrizado), NO concatenación
- [ ] **Hashing:** Contraseñas con `await hashPassword()`
- [ ] **Tokens:** UUIDs con `crypto.randomUUID()`, NUNCA `Math.random()`
- [ ] **Errores:** No exponen info sensible, no revelan si usuario existe
- [ ] **Auth:** Rutas privadas tienen `authMiddleware`
- [ ] **Rol:** Rutas admin tienen `requireRole(['organizador'])`
- [ ] **Validación:** Input validado con `express-validator`
- [ ] **CORS:** No usar `*`, usar `process.env.FRONTEND_URL`
- [ ] **Rate limiting:** Endpoints públicos tienen limiter
- [ ] **Logs:** No loguear contraseñas ni tokens

### Escribiendo Código Frontend

#### Crear una Nueva Página

```astro
---
// pages/nueva-pagina.astro
import Layout from "../layouts/Layout.astro";

const titulo = "Mi Nueva Página";
---

<Layout title={titulo}>
  <h1>{titulo}</h1>
  
  <p>Contenido de la página</p>
  
  <script>
    // Código JavaScript lado cliente
    const respuesta = await fetch('http://localhost:3001/api/endpoint', {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('accessToken'),
      },
    });
  </script>
</Layout>
```

#### Hacer Requests a la API

```javascript
// Patrón recomendado
const accessToken = localStorage.getItem('accessToken');

fetch('http://localhost:3001/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + accessToken,
  },
  body: JSON.stringify({ campo: valor }),
})
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      mostrarError(data.error.message);
    } else {
      actualizar(data);
    }
  })
  .catch(err => mostrarError(err.message));
```

### Cambios en Base de Datos

1. **Editar `backend/src/models/migrate.js`:**
```sql
CREATE TABLE IF NOT EXISTS nueva_tabla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nueva_tabla_usuario ON nueva_tabla(usuario_id);
```

2. **Registrar en `seed.js` si necesitas datos de prueba**

3. **Ejecutar:**
```bash
npm run migrate
```

## Testing

### Ejecutar Tests
```bash
npm test --prefix backend
```

### Escribir un Test Básico
```javascript
// backend/__tests__/auth.test.js
const request = require('supertest');
const app = require('../src/server');

describe('Auth Module', () => {
  test('POST /api/auth/login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'monitor1@example.com',
        password: 'password123',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });
});
```

## Commits y Pull Requests

### Convención de Commits

```
feat: agregar nuevo endpoint /api/ejemplo
fix: corregir validación de email
security: mejorar rate limiting en login
refactor: reorganizar middleware
docs: actualizar SKILL.md
test: agregar tests para auth
```

### Mensaje de Commit Detallado

```
feat: agregar endpoint POST /api/monitor/descuento

- Agregar descuento especial para pago de joven
- Validar que monitor es el propietario
- Actualizar tabla pagos con descuento_especial
- Enviar email de confirmación
- Documentar en SKILL.md

Fixes #123
```

### Antes de hacer Push

```bash
# 1. Actualizar CHANGELOG.md
# 2. Ejecutar tests
npm test --prefix backend

# 3. Verificar linting (opcional)
# npm run lint --prefix backend

# 4. Hacer commit
git commit -m "feat: descripcion"

# 5. Push o PR
git push origin feature/mi-feature
```

## Despliegue

### Deploy a Staging (Docker)

```bash
docker-compose build --no-cache
docker-compose down
docker-compose up -d
docker-compose exec backend npm run migrate
```

### Deploy a Producción

Ver [DEPLOYMENT.md](./DEPLOYMENT.md)

## Troubleshooting común

### Error: "EADDRINUSE: address already in use :::3001"
```bash
# Matar proceso en puerto
lsof -ti :3001 | xargs kill -9
npm run dev
```

### Error: "relation does not exist"
```bash
cd backend
npm run migrate
```

### Error: "JWT validation failed"
```bash
# Limpiar localStorage del navegador
# Developer Tools → Application → Local Storage → Clear All
# Hacer login nuevamente
```

### Error: "CORS error"
Verificar que `FRONTEND_URL` en backend/.env coincide con tu origen.

## Mejores Prácticas

### Code Style
```javascript
// ✅ BIEN
const handleLogin = async (email, password) => {
  try {
    const user = await findUser(email);
    if (!user) throw new Error('User not found');
    return user;
  } catch (err) {
    logger.error('Login error:', err);
    throw err;
  }
};

// ❌ MAL
function handleLogin(e, p) {
  var u = db.query("SELECT * FROM usuarios WHERE email = '" + e + "'");
  return u;
}
```

### Error Handling
```javascript
// ✅ BIEN - Mensajes seguros
return res.status(401).json({
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  },
});

// ❌ MAL - Revela info
return res.status(401).json({
  error: 'User with email ' + email + ' not found!',
});
```

### Async/Await
```javascript
// ✅ BIEN
const result = await pool.query(
  'SELECT * FROM usuarios WHERE id = $1',
  [userId]
);

// ❌ MAL
const result = pool.query(
  'SELECT * FROM usuarios WHERE id = $1',
  [userId]
); // Missing await!
```

## Documentación

Cuando agregues una feature, actualiza:
1. **SKILL.md** - Si es un nuevo endpoint
2. **ARCHITECTURE.md** - Si cambia el arquitectura
3. **CHANGELOG.md** - Siempre
4. **README.md** - Si afecta instalación/uso

## Comunidad y Ayuda

- Revisa issues abiertos en GitHub
- Busca en la documentación antes de preguntar
- Comenta tu código cuando sea complejo
- Haz PRs con descripción clara

## Licencia

Al contribuir, aceptas que tu código está bajo la misma licencia del proyecto (Privado).

---

**¡Gracias por contribuir a Paroikiapp! 🎉**
