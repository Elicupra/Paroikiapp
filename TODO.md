# TODO - Funcionalidades Pendientes Paroikiapp

## ⚠️ URGENTES

### 1. Crear Eventos (Admin)
**Estado:** No implementado  
**Prioridad:** Alta  
**Descripción:**
- Formulario para crear nuevos eventos desde el panel de administrador
- Campos necesarios:
  - Nombre del evento
  - Tipo (campamento, retiro, etc.)
  - Descripción
  - Precio base
  - Fecha de inicio
  - Fecha de fin
- **Backend:** Endpoint POST /api/admin/eventos ya existe
- **Frontend:** Falta crear el formulario y la lógica

---

### 2. Gestionar Jóvenes (Admin)
**Estado:** Vista básica implementada, falta CRUD  
**Prioridad:** Alta  
**Descripción:**
- Vista detallada de cada joven
- Formulario para crear jóvenes manualmente (sin registro público)
- Editar información de jóvenes existentes
- Eliminar jóvenes
- Asignar/reasignar jóvenes a eventos
- Ver historial completo (pagos, documentos)

**Endpoints necesarios:**
- POST /api/admin/jovenes (crear)
- PUT /api/admin/jovenes/:id (editar)
- DELETE /api/admin/jovenes/:id (eliminar)

---

## 📋 IMPORTANTES

### 3. Panel de Detalle de Evento
**Estado:** No implementado  
**Prioridad:** Media-Alta  
**Descripción:**
- Vista completa de un evento específico
- Información del evento (nombre, fechas, precio, descripción)
- Lista de todos los jóvenes registrados en ese evento
- Resumen de pagos del evento
- Estadísticas:
  - Total participantes
  - Total recaudado
  - Documentación pendiente
  - Pagos pendientes

**Endpoints necesarios:**
- GET /api/admin/eventos/:id (existe como /jovenes pero necesita más datos)
- GET /api/admin/eventos/:id/estadisticas (nuevo)

---

### 5. Subir Documentos (Monitor)
**Estado:** Backend parcial, frontend no implementado  
**Prioridad:** Media-Alta  
**Descripción:**
- Interface para que los monitores suban documentos en nombre de los jóvenes
- Tipos de documentos:
  - Autorización paterna
  - Documentación médica
  - Seguro
  - Otros documentos requeridos
- Ver lista de documentos subidos por joven
- Descargar documentos existentes

**Backend pendiente:**
- POST /api/monitor/documentos (con multer para files)
- GET /api/monitor/jovenes/:jovenId/documentos
- GET /api/monitor/documentos/:id/download
- DELETE /api/monitor/documentos/:id

**Frontend pendiente:**
- Formulario de upload con drag & drop
- Preview de archivos
- Lista de documentos con iconos por tipo
- Botones de descarga/eliminar

---

### 6. Panel del Joven (Después de Registro)
**Estado:** No implementado  
**Prioridad:** Media  
**Descripción:**
- Página para que el joven vea su perfil después de registrarse
- Información personal
- Estado del evento (fechas, ubicación)
- Estado de pagos
- Subir documentos personales:
  - DNI/Pasaporte
  - Foto
  - Otros documentos requeridos
- Ver estado de verificación de documentos

**Endpoints necesarios:**
- GET /api/joven/perfil (con token único o auth)
- POST /api/joven/documentos
- GET /api/joven/documentos
- GET /api/joven/evento-info

---

### 7. Gestionar Documentos (Admin)
**Estado:** No implementado  
**Prioridad:** Media  
**Descripción:**
- Ver todos los documentos del sistema
- Filtrar por:
  - Evento
  - Joven
  - Tipo de documento
  - Estado (pendiente verificación, aprobado, rechazado)
- Validar/aprobar documentos
- Descargar documentos
- Eliminar documentos
- Marcar documentos como verificados

**Endpoints necesarios:**
- GET /api/admin/documentos (con filtros)
- PATCH /api/admin/documentos/:id/verificar
- DELETE /api/admin/documentos/:id

---

## 🔄 MEJORAS ADICIONALES

### 8. Notificaciones Email
**Estado:** Implementado pero con errores SMTP  
**Prioridad:** Baja (funcional sin emails)  
**Descripción:**
- Configurar correctamente SMTP (Brevo u otro servicio)
- Notificaciones implementadas en:
  - Registro de joven
  - Registro de pago
- Notificaciones pendientes:
  - Documento subido
  - Documento verificado
  - Evento próximo a iniciar

---

### 9. Reportes y Estadísticas
**Estado:** No implementado  
**Prioridad:** Baja  
**Descripción:**
- Dashboard con estadísticas generales
- Exportar listas de participantes (Excel/PDF)
- Reportes de pagos
- Reportes de documentación
- Gráficos de inscripciones por evento

---

### 10. Gestión de Usuarios (Admin)
**Estado:** Vista básica implementada, falta CRUD  
**Prioridad:** Media  
**Descripción:**
- Crear nuevos monitores/organizadores
- Editar usuarios existentes
- Desactivar/activar usuarios
- Asignar monitores a eventos
- Ver actividad de usuarios

**Endpoints necesarios:**
- POST /api/admin/usuarios (existe pero falta frontend)
- PUT /api/admin/usuarios/:id
- PATCH /api/admin/usuarios/:id/toggle-active


### 11. Navegación
**Estado:** Panel Navbar
**Prioridad:** Alta 
**Descripción:**
- Inicio
- Panel de monitor (oculto para usuarios no monitores, administrador si puede verlo y tiene acceso a las funcionalidades)
- Panel de admin (solo los administradores pueden verlo y acceder)
- Gestor de Usuarios (solo visible para administradores):
    - Listado de usuarios
    - Crear usuario
    - Editar usuario
    - Desactivar/activar usuario
    - Si el usuario es monitor, asignar eventos a ese monitor
    - Si el usuario que accede es monitor, solo puede ver los eventos a los que está asignado y gestionar los jóvenes de esos eventos. No puede ver ni gestionar otros eventos ni otros jóvenes.

**Endpoints necesarios:**
- POST /api/admin/usuarios (existe pero falta frontend)
- PUT /api/admin/usuarios/:id
- PATCH /api/admin/usuarios/:id/toggle-active

---

## ✅ COMPLETADO

- ✅ Sistema de autenticación (JWT + refresh tokens)
- ✅ Panel de administrador (vista base)
- ✅ Panel de monitor (vista base)
- ✅ Lista de eventos (lectura)
- ✅ Lista de usuarios (lectura)
- ✅ Lista de jóvenes (lectura)
- ✅ Registro de pagos (monitor)
- ✅ Enlaces de registro (generación y compartir)
- ✅ Registro público de jóvenes (vía token)
- ✅ Base de datos con schema personalizado
- ✅ Seed de datos de prueba
- ✅ Dropdown de jóvenes en monitor (arreglado)

---

## 📝 NOTAS TÉCNICAS

### Credenciales de Prueba:
```
Admin:
  Email: admin@example.com
  Password: password123

Monitor 1:
  Email: monitor1@example.com
  Password: password123

Monitor 2:
  Email: monitor2@example.com
  Password: password123
```

### Estructura de Base de Datos:
- **eventos**: Información de eventos
- **usuarios**: Monitores y organizadores
- **monitores**: Relación usuario-evento con tokens
- **jovenes**: Participantes registrados
- **documentos**: Archivos subidos
- **pagos**: Registro de pagos por plazo
- **refresh_tokens**: Tokens de sesión

### Puertos:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000
- Database: 192.168.1.10:5432 (PostgreSQL)

---

**Fecha última actualización:** 19 de febrero de 2026
