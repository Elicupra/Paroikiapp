# INSTRUCTIONS — Historial de Requerimientos de Paroikiapp

> Fuente de verdad de todos los requerimientos recibidos por orden cronológico.
> Un agente debe leer este fichero antes de cualquier implementación para entender el contexto completo.
> Los requerimientos son acumulativos: cada iteración amplía o modifica la anterior, nunca la reemplaza salvo que se indique explícitamente.

---

## Iteración 0 — Diseño inicial (2026-02-19)

### Contexto
Aplicación de registro de eventos juveniles alojada en homelab propio.

### Requerimientos funcionales

**Datos del participante (joven):**
- Nombre y apellidos
- Adjunto de Autorización Paterna (opcional, se rellena cerca del evento)
- Adjunto de Tarjeta Sanitaria (opcional, se rellena cerca del evento)

**Control de acceso:**
- Solo se puede registrar si el monitor comparte su enlace de evento
- El joven queda asociado automáticamente al monitor cuyo enlace usó

**Pagos (registro manual, nunca procesamiento real):**
- Los pagos los registra el monitor
- Existen diferentes plazos y cantidades
- Puede existir un descuento aplicado a posteriori
- Campo especial para pagos distintos al precio establecido

**Seguridad:**
- Acceso solo por enlace compartido o por login con credenciales ad hoc
- El usuario puede cambiar contraseña y correo, pero NO el nombre de usuario
- Protección: SQL Injection, DDoS, acceso no autorizado

**Reutilización:** El sistema debe funcionar para campamentos, peregrinaciones y viajes.

### Decisiones de diseño

- Stack: Node.js + Express · PostgreSQL · Astro SSR · Nginx
- Auth: JWT 15 min + refresh token httpOnly cookie
- Archivos: fuera del webroot, servidos por endpoint autenticado, nombre UUID
- Enlace de monitor: UUID v4 por par monitor+evento, revocable
- Evento como entidad central para reutilización

---

## Iteración 1 — Roles, Navbar, Enlace personal del joven (2026-02-20)

### Roles definidos

**Administrador:**
- Creado en seed inicial; puede existir más de uno
- Acceso total: eventos, tipos de evento, usuarios, monitores, estadísticas
- Crea, edita y borra cualquier entidad
- Asigna eventos a monitores con límite de jóvenes por monitor (`max_jovenes`)
- Reajusta precio de evento: cambio de coste base o descuento global
- Ve recaudación total y por monitor de cada evento
- Accede a FAQ completa

**Monitor:**
- Solo existe cuando el Administrador lo crea (sin auto-registro)
- Ve únicamente eventos que el Admin le asigna
- Ve únicamente jóvenes que él administra por evento
- Puede editar y borrar sus jóvenes
- Registra pagos con casilla especial para importes distintos al esperado
- Accede al detalle de un joven desde el evento haciendo clic en su nombre
- Ve recaudación de su grupo y total esperado
- Gestiona su información y preferencias de notificación

**Joven (participante, sin cuenta de usuario):**
- Accede a su ficha personal mediante enlace único generado en el registro
- Puede modificar sus datos y subir documentos
- No accede a ninguna otra parte de la aplicación

**Anónimo:**
- Solo accede a la landing: info de parroquia, eventos públicos, login

### Enlace de registro del joven

1. Monitor comparte su enlace de evento (`/register/:monitor_token`)
2. Joven rellena nombre y apellidos (y opcionalmente sube documentos)
3. Tras el registro se genera un **enlace personal único** (`/ficha/:joven_token`)
4. Ese enlace se muestra **una sola vez** con botón de copiar
5. Con ese enlace el joven puede modificar sus datos y subir documentos en el futuro
6. El joven no accede a ninguna otra URL de la aplicación

### Tipos de evento

- El admin gestiona los tipos de evento (tabla `tipos_evento`)
- Defaults: Campamento, Peregrinación, Viaje
- Si precio = 0: advertencia + confirmación explícita → `coste_cero = true`
- Con `coste_cero = true`: sin columnas de precio ni lógica de pagos en toda la app

### Navbar (primera definición)

| Sección | Anónimo | Monitor | Admin |
|---|---|---|---|
| Inicio | ✅ | ✅ | ✅ |
| Panel Administrador | ❌ | ❌ | ✅ |
| Panel Monitor | ❌ | ✅ | ✅ |
| Eventos | ❌ | ✅ | ✅ |
| FAQ | ❌ | ✅ | ✅ |
| Contacto | ✅ | ✅ | ✅ |

---

## Iteración 2 — Navegación rediseñada, UX completa, CORS y gestión de errores (2026-02-23)

### Estado de partida
El proyecto está en v1.3.7 con backend funcional, smoke tests, CI en GitHub Actions y páginas Astro operativas. Las acciones en el frontend están vacías en muchos puntos y no se devuelve información o errores de forma consistente.

### Estructura de navegación (nueva definición, reemplaza Iteración 1)

Orden de la navbar: **Inicio · Eventos · Contacto · Panel de Administrador · Monitor · Panel de Monitor · Usuarios · Inicio de Sesión · Configuración**

Visibilidad por rol:

| Ítem de navbar | Anónimo | Monitor | Admin |
|---|---|---|---|
| Inicio | ✅ | ✅ | ✅ |
| Eventos | ✅ | ✅ | ✅ |
| Contacto | ✅ | ✅ | ✅ |
| Panel de Administrador | ❌ | ❌ | ✅ |
| Monitor | ❌ | ❌ | ✅ |
| Panel de Monitor | ❌ | ✅ | ✅ |
| Usuarios | ❌ | ✅ (solo los suyos) | ✅ |
| Inicio de Sesión | ✅ (anónimo) | ❌ | ❌ |
| Configuración | ❌ | ❌ | ✅ |

> Nota: "Monitor" en la navbar es la sección de gestión de monitores como entidad (admin), diferente de "Panel de Monitor" que es el dashboard personal de cada monitor.

### Detalle de cada sección

#### Inicio (`/`)
- Sección principal: **carrusel de eventos abiertos** (cards interactivas; clic abre detalle del evento)
- Sección secundaria: **información de la parroquia** (texto estático con componente editable desde Configuración)
- El texto de parroquia es editable por el administrador desde Panel de Administrador → Configuración
- Texto de ejemplo incluido en seed para que no aparezca vacío en primer despliegue

#### Eventos (`/eventos`)
- Vista pública: lista de eventos actuales (mismo contenido que las cards del inicio)
- Vista admin: CRUD completo + filtros + vista tabla/cards conmutable
- Vista monitor: solo eventos asignados a él
- Filtros (admin y monitor): por tipo de evento, fechas, texto libre
- Orden configurable (fecha, nombre, tipo)
- Buscador de texto expandible bajo icono (no visible por defecto)

#### Contacto (`/contacto`)
- Formulario: nombre, email, asunto, mensaje
- El mensaje se envía por email a los administradores (usando el SMTP configurado)
- No requiere autenticación

#### Panel de Administrador (`/admin`)
- Dashboard con tarjetas de resumen: total eventos activos, total monitores, total jóvenes, recaudación global
- Cada tarjeta es clicable y navega a la sección correspondiente:
  - **Monitores** → `/monitor` (gestión de monitores)
  - **Jóvenes** → `/usuarios` (filtrado automáticamente con todos los jóvenes)
  - **Eventos** → `/eventos` (vista con permisos de admin)
- La info de parroquia es editable desde aquí (o desde Configuración)

#### Monitor (`/monitor`) — acceso solo Admin
- Lista de monitores existentes: creación, edición, borrado
- El admin asigna monitores a eventos desde aquí
- Al hacer clic en un monitor: mini-dashboard con eventos responsables, jóvenes por evento, recaudación de ese monitor

#### Panel de Monitor (`/panel-monitor`) — acceso Admin y Monitor
- Dashboard personal del monitor con su información
- Tarjetas: eventos asignados, jóvenes por evento
- Clic en Jóvenes → `/usuarios` filtrado con sus propios jóvenes
- Clic en Eventos → `/eventos` con solo sus eventos
- Gestión de grupos por evento: puede crear jóvenes manualmente (si el enlace falla o el joven no puede auto-registrarse)
- Puede editar y borrar sus jóvenes
- Sección de perfil personal: nombre mostrado, correo
- Sección de notificaciones: activar/desactivar email, configurar webhook
- Adjuntar ficheros propios del monitor (solo visibles para él y el admin)

#### Usuarios (`/usuarios`)
- Buscador principal de participantes (jóvenes)
- Buscador de texto oculto bajo icono, expandible
- Filtros desplegables: nombre, apellidos, evento, monitor asignado, fecha de registro
- Cuando viene desde Panel Admin → Jóvenes: muestra lista completa
- Cuando viene desde Panel Monitor → Jóvenes: muestra solo los del monitor
- Operaciones según rol: admin puede crear/editar/borrar cualquier joven; monitor solo los suyos

#### Inicio de Sesión (`/login`)
- Formulario para admin y monitor
- Campo especial: si el usuario pega un enlace de ficha personal (`/ficha/:token`), redirige a esa ficha
- Si ya hay sesión activa, redirige al panel correspondiente según rol

#### Configuración (`/configuracion`) — acceso solo Admin
- Panel estable con secciones:
  1. **Parroquia**: nombre de la app (reemplaza "Paroikiapp"), logo/icono, texto descriptivo de la parroquia
  2. **Apariencia**: colores primario/secundario/acento de la aplicación (variables CSS)
  3. **Contacto**: email de contacto público, teléfono, dirección
  4. **Sistema**: info de versión, estado de SMTP (test de conexión)
- Diseñado para ser extensible: nuevas secciones en el futuro sin romper las existentes
- Los cambios se persisten en BD (tabla `configuracion`)

### Comunicación Frontend ↔ Backend

**CORS:**
- El backend Express debe tener CORS configurado explícitamente con `FRONTEND_URL` de `.env`
- Cualquier origen no autorizado recibe 403 con mensaje claro en consola del servidor
- El frontend nunca debe tener URLs hardcodeadas; siempre usa `PUBLIC_API_URL`

**Gestión de errores (nueva política unificada):**

| Tipo de error | Dónde aparece | Formato |
|---|---|---|
| Error de red / CORS | Consola del servidor + banner en pantalla | Banner rojo no intrusivo, 5 segundos |
| 401 No autenticado | Redirección a `/login` + mensaje | Toast informativo |
| 403 Sin permisos | Banner en pantalla | Banner naranja con descripción |
| 404 Recurso no encontrado | Inline en el componente | Mensaje dentro del área afectada |
| 400 Validación | Inline en el formulario | Debajo del campo con fallo |
| 500 Error de servidor | Banner en pantalla | Banner rojo con código de error |
| Acción vacía / sin respuesta | Feedback visual inmediato | Spinner mientras carga, mensaje si falla |

**Regla general:** todo fetch del frontend debe tener `try/catch` con manejo explícito. Los errores críticos (5xx, CORS) se muestran en pantalla de forma amigable. Los errores de validación (4xx) se muestran inline. Nunca una acción silenciosa.

**Componente de notificación global:**
- Un componente `Toast.astro` / `Banner.astro` que reciba `{ tipo, mensaje, duracion }` y se posicione en esquina superior derecha
- Accesible desde cualquier página
- Niveles: `info`, `success`, `warning`, `error`

### Nuevas entidades de BD requeridas

```sql
-- Configuración global de la app (editable por admin desde /configuracion)
CREATE TABLE configuracion (
  clave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL,
  tipo   TEXT DEFAULT 'texto'  -- 'texto', 'color', 'imagen', 'booleano'
);
-- Seed obligatorio con valores por defecto:
INSERT INTO configuracion VALUES
  ('app_nombre',        'Paroikiapp',           'texto'),
  ('parroquia_nombre',  'Parroquia San Miguel',  'texto'),
  ('parroquia_texto',   'Bienvenidos a nuestra parroquia. Aquí encontrarás información sobre nuestros eventos y actividades para jóvenes.', 'texto'),
  ('parroquia_logo',    '',                      'imagen'),
  ('color_primario',    '#2563eb',               'color'),
  ('color_secundario',  '#1e40af',               'color'),
  ('color_acento',      '#f59e0b',               'color'),
  ('contacto_email',    '',                      'texto'),
  ('contacto_telefono', '',                      'texto'),
  ('contacto_direccion','',                      'texto');

-- Ficheros privados de monitor (solo visibles para él y admin)
CREATE TABLE monitor_ficheros (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id   UUID        REFERENCES monitores(id) ON DELETE CASCADE,
  ruta_interna TEXT        NOT NULL,
  nombre_original TEXT,
  mime_type    TEXT        NOT NULL,
  subido_en    TIMESTAMPTZ DEFAULT now()
);
```

### Nuevos endpoints requeridos

```
-- Configuración global
GET  /api/admin/configuracion                    → { clave, valor }[]
PUT  /api/admin/configuracion                    Body: { clave, valor }[]

-- Contacto público
POST /api/public/contacto                        Body: { nombre, email, asunto, mensaje }

-- Ficheros del monitor
GET    /api/monitor/ficheros
POST   /api/monitor/ficheros                     Multipart: { file }
DELETE /api/monitor/ficheros/:ficheroId
GET    /api/admin/monitores/:monitorId/ficheros  (admin ve los de cualquier monitor)

-- Dashboard del admin
GET  /api/admin/dashboard                        → { total_eventos, total_monitores, total_jovenes, recaudacion_global }

-- Dashboard del monitor (ya existe como resumen)
GET  /api/monitor/resumen?evento_id=:id          (ya implementado, verificar)

-- Mini-dashboard de un monitor concreto (para admin)
GET  /api/admin/monitores/:monitorId/dashboard   → { eventos[], jovenes_por_evento[], recaudacion }
```

### Ficheros frontend nuevos o a modificar

```
frontend/src/
├── pages/
│   ├── index.astro              MODIFICAR: carrusel + info parroquia dinámica
│   ├── eventos/
│   │   └── index.astro          MODIFICAR: filtros, vista tabla/cards, permisos por rol
│   ├── contacto.astro           NUEVO: formulario de contacto
│   ├── admin/
│   │   └── index.astro          MODIFICAR: dashboard con tarjetas clicables
│   ├── monitor/
│   │   └── index.astro          MODIFICAR: lista de monitores (gestión) - solo admin
│   ├── panel-monitor/
│   │   └── index.astro          NUEVO/MODIFICAR: dashboard personal del monitor
│   ├── usuarios/
│   │   └── index.astro          MODIFICAR: buscador con filtros expandibles
│   ├── login.astro              MODIFICAR: campo enlace ficha + redirect por rol
│   └── configuracion/
│       └── index.astro          NUEVO: panel de configuración admin
├── components/
│   ├── Navbar.astro             MODIFICAR: nueva estructura con todos los ítems
│   ├── Toast.astro              NUEVO: sistema de notificaciones en pantalla
│   ├── Carrusel.astro           NUEVO: carrusel de eventos para inicio
│   ├── EventoCard.astro         NUEVO/REVISAR: card de evento para carrusel y listados
│   ├── BuscadorFiltros.astro    NUEVO: componente de búsqueda expandible reutilizable
│   └── ErrorBoundary.astro      NUEVO: wrapper de gestión de errores por sección
└── layouts/
    └── Layout.astro             MODIFICAR: inyectar variables CSS de configuración, incluir Toast
```

---

## Pendiente / Backlog (no incluido en Iteración 2)

- Sistema de backup automático de BD
- Webhooks para monitores externos (diseñado en SKILL, sin implementar)
- Dashboard avanzado con gráficas (charts)
- API de reportes exportables
- Sistema de descuentos automáticos
- Tests E2E (Playwright o similar)
- Certificados SSL/TLS para producción
- Fail2ban configurado en producción
- FAQ / Guía de uso (contenido pendiente de definir)
- Sección de Configuración extensible: nuevas secciones previstas pero no definidas aún

---

## Convenciones globales

- Nombre del proyecto: **Paroikiapp** (configurable desde Configuración)
- Participantes: **jóvenes**
- Gestores de grupo: **monitores**
- Super-gestores: **administradores**
- Roles en BD: `organizador`, `administrador` (ambos tienen permisos de admin)
- `PUBLIC_API_URL` siempre desde variable de entorno de Astro, nunca hardcodeado
- Nunca procesar pagos reales
- Nunca servir archivos adjuntos sin validar propiedad
