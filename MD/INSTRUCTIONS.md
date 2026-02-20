# INSTRUCTIONS — Historial de Requerimientos de Paroikiapp

> Este fichero recoge todos los prompts y decisiones de diseño tomadas durante el desarrollo de Paroikiapp.
> Sirve como fuente de verdad para futuras iteraciones y como contexto para agentes de desarrollo.

---

## Iteración 0 — Diseño inicial (Febrero 2026)

### Requerimientos originales

**Alojamiento:** Homelab propio.

**Datos del joven (participante):**
- Nombre y Apellidos
- Adjunto de Autorización Paterna (opcional, se rellena cerca del campamento)
- Adjunto de Tarjeta Sanitaria (opcional, se rellena cerca del campamento)

**Control de acceso:**
- Solo se puede acceder si el monitor comparte el enlace del evento
- Cada joven queda asociado automáticamente al monitor que compartió el enlace

**Pagos:**
- Los pagos los registra el monitor, nunca se procesan desde la aplicación
- Existen diferentes plazos y cantidades
- Puede existir un descuento (se sabe a posteriori)
- Campo especial para pagos distintos al establecido

**Seguridad:**
- Acceso solo por enlace o por login con credenciales creadas ad hoc
- Las credenciales las crea el sistema; el usuario solo puede cambiar contraseña y correo (no el nombre de usuario)
- Protección contra SQL Injection, DDoS y acceso no autorizado

**Reutilización:** La aplicación debe funcionar para campamentos, peregrinaciones y viajes bajo el mismo sistema.

### Decisiones de diseño tomadas

- **Stack:** Node.js + Express (backend) · Astro SSR (frontend) · PostgreSQL · Nginx
- **Auth:** JWT de corta duración (15 min) + refresh token en cookie httpOnly
- **Archivos:** Almacenados fuera del webroot, servidos por endpoint autenticado, renombrados con UUID
- **Enlace de monitor:** UUID v4 único por par monitor+evento, revocable manualmente
- **Evento como entidad central:** permite reutilizar sin modificar código

---

## Iteración 1 — Roles, Navbar, Eventos y Enlace Personal del Joven (Febrero 2026)

### Roles definidos

#### Administrador
- Existe desde el despliegue inicial (creado en seed/migración)
- Puede existir más de uno
- Acceso completo: crear, editar y borrar eventos, usuarios y tipos de evento
- Ve lo recaudado por evento, por monitor y el total esperado
- Puede restringir el número máximo de jóvenes por monitor por evento
- Puede reajustar el precio de un evento:
  - Cambiando el coste por persona
  - Aplicando un descuento global
- Ve el panel de administración, panel de monitores (para gestionar monitores y sus eventos asociados), eventos y FAQ completa

#### Monitor
- Solo existe cuando el Administrador lo crea (no hay auto-registro)
- Solo ve los eventos que el Administrador le asigna
- Solo ve los jóvenes que él mismo administra dentro de cada evento
- Puede borrar o editar los jóvenes que administra
- Ve lo recaudado de su grupo por evento y el total esperado de su grupo
- Tiene casilla especial de pago diferente al esperado por cada joven
- Puede acceder al detalle de un joven desde el evento haciendo clic en su nombre
- Gestiona su propia información desde el Panel Monitor

#### Anónimo
- Acceso solo a la landing page / inicio
- Puede ver información de la parroquia y eventos actuales publicados
- Puede iniciar sesión desde esta página

### Enlace de registro del joven (nuevo comportamiento)

El enlace de monitor es el punto de entrada al registro. El flujo exacto es:

1. El monitor comparte el enlace del evento con los jóvenes
2. El joven accede al enlace y rellena nombre y apellidos
3. Tras el registro, se genera un **enlace personal único** para ese joven
4. Ese enlace es visible en pantalla una sola vez (puede copiarlo)
5. Con ese enlace personal el joven puede:
   - Acceder a su ficha en el futuro
   - Modificar sus datos
   - Subir documentos (Autorización Paterna y Tarjeta Sanitaria: texto, PDF o imagen)
6. Durante el propio registro, los campos de subida de documentos están disponibles opcionalmente
7. El joven **no tiene acceso a ninguna otra parte de la aplicación**
8. El enlace personal es diferente al enlace del monitor

### Tipos de evento

- El administrador crea y gestiona los tipos de evento
- Por defecto existen: **Campamento**, **Peregrinación**, **Viaje**
- Al crear un evento con coste 0:
  - Se muestra una advertencia y se pide confirmación explícita
  - Si se confirma coste 0: no se muestran precios en ningún lugar de la app ni aplica la lógica de pagos

### Navbar

Adaptativa (responsive). Visibilidad por rol:

| Sección | Anónimo | Monitor | Administrador |
|---|---|---|---|
| Inicio | ✅ | ✅ | ✅ |
| Panel Administrador | ❌ | ❌ | ✅ |
| Panel Monitor | ❌ | ✅ | ✅ (gestiona monitores y sus eventos) |
| Eventos | ❌ | ✅ (solo los suyos) | ✅ (dashboard completo) |
| FAQ / Guía de uso | ❌ | ✅ (guía de monitor) | ✅ (guía completa) |
| Contacto | ✅ | ✅ | ✅ |

**Detalle de cada sección:**

- **Inicio:** Landing pública con info de la parroquia, eventos actuales y botón de login
- **Panel Administrador:** Gestión de eventos, usuarios, tipos de evento, estadísticas globales
- **Panel Monitor (Admin):** Lista de monitores, eventos asignados a cada uno
- **Panel Monitor (Monitor):** Gestión de información propia y preferencias de notificación
- **Eventos (Admin):** Dashboard con todos los eventos, recaudación total, gestión
- **Eventos (Monitor):** Lista de eventos asignados, recaudación de su grupo
- **FAQ (Admin):** Ayuda para todos los roles
- **FAQ (Monitor):** Ayuda para gestión de panel, eventos y jóvenes
- **Contacto:** Formulario o información de contacto, accesible para todos

---

## Decisiones técnicas acumuladas

### Base de datos — cambios respecto a Iteración 0

```sql
-- Tabla nueva: tipos de evento (gestionable por admin)
CREATE TABLE tipos_evento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true
);
-- Insertar por defecto: Campamento, Peregrinación, Viaje

-- eventos: añadir campos
ALTER TABLE eventos ADD COLUMN tipo_evento_id UUID REFERENCES tipos_evento(id);
ALTER TABLE eventos ADD COLUMN coste_cero BOOLEAN DEFAULT false;
ALTER TABLE eventos ADD COLUMN descuento_global NUMERIC(8,2) DEFAULT 0;

-- monitores: añadir límite de jóvenes
ALTER TABLE monitores ADD COLUMN max_jovenes INTEGER DEFAULT NULL; -- NULL = sin límite

-- jovenes: añadir enlace personal único
ALTER TABLE jovenes ADD COLUMN enlace_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid();

-- Tabla nueva: asignacion_eventos (monitor ↔ eventos visibles)
CREATE TABLE asignacion_eventos (
  monitor_id UUID REFERENCES monitores(id) ON DELETE CASCADE,
  evento_id UUID REFERENCES eventos(id) ON DELETE CASCADE,
  PRIMARY KEY (monitor_id, evento_id)
);
```

### Nuevos endpoints requeridos

```
-- Tipos de evento (admin)
GET    /api/admin/tipos-evento
POST   /api/admin/tipos-evento
PATCH  /api/admin/tipos-evento/:id
DELETE /api/admin/tipos-evento/:id

-- Enlace personal del joven
GET    /ficha/:joven_token              (público, sin auth)
PATCH  /ficha/:joven_token             (actualizar datos del joven)
POST   /ficha/:joven_token/documento   (subir documentos)

-- Estadísticas de recaudación
GET    /api/admin/eventos/:id/recaudacion
GET    /api/monitor/eventos/:id/recaudacion

-- Asignación de eventos a monitores
POST   /api/admin/monitores/:id/eventos
DELETE /api/admin/monitores/:id/eventos/:evento_id

-- Límite de jóvenes por monitor
PATCH  /api/admin/monitores/:id/max-jovenes
```

---

## Pendiente / Backlog

- Notificaciones por email al monitor cuando se registra un joven (diseñado en Iter. 0, no confirmado implementado)
- Webhook saliente opcional (diseñado en SKILL.md Iter. 0)
- Tests unitarios para los nuevos endpoints
- Seed inicial con usuario administrador por defecto
- Página de Contacto (contenido pendiente de definir)
- Contenido de la landing pública (texto de parroquia, pendiente del cliente)
- Definir si la FAQ es contenido estático o editable desde el admin

---

## Convenciones de nomenclatura

- El proyecto se llama **Paroikiapp** (de *paroikia*, parroquia en griego)
- Los participantes se llaman **jóvenes** en toda la app y documentación
- Los gestores de grupo se llaman **monitores**
- Los super-gestores se llaman **administradores**
