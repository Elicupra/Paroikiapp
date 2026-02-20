const assert = require('assert');

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const headers = Object.assign({}, options.headers || {});

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { status: response.status, data };
}

function ok(condition, message) {
  assert.ok(condition, message);
}

async function run() {
  console.log('== Smoke API: admin eventos + asignaciones ==');

  const login = await request('/api/auth/login', {
    method: 'POST',
    json: { email: 'admin@example.com', password: 'password123' },
  });

  ok(login.status === 200, 'Login admin debe devolver 200');
  ok(login.data?.accessToken, 'Login admin debe devolver accessToken');
  const token = login.data.accessToken;

  const eventosRes = await request('/api/admin/eventos?incluir_pasados=true', { token });
  ok(eventosRes.status === 200, 'GET /api/admin/eventos debe devolver 200');
  ok(Array.isArray(eventosRes.data?.data), 'GET /api/admin/eventos debe devolver array');
  ok(eventosRes.data.data.length > 0, 'Debe existir al menos 1 evento para smoke test');
  const baseEvento = eventosRes.data.data[0];

  const recaudacionRes = await request(`/api/admin/eventos/${baseEvento.id}/recaudacion`, { token });
  ok(recaudacionRes.status === 200, 'GET /api/admin/eventos/:id/recaudacion debe devolver 200');
  ok(recaudacionRes.data?.data && typeof recaudacionRes.data.data.total_recaudado === 'number', 'Recaudacion debe incluir total_recaudado');
  ok(Array.isArray(recaudacionRes.data.data.por_monitor), 'Recaudacion debe incluir por_monitor[]');

  const usuariosRes = await request('/api/admin/usuarios', { token });
  ok(usuariosRes.status === 200, 'GET /api/admin/usuarios debe devolver 200');
  const monitor = (usuariosRes.data?.data || []).find((u) => u.rol === 'monitor' && u.activo);
  ok(!!monitor, 'Debe existir al menos un monitor activo');

  const now = Date.now();
  const createEventoRes = await request('/api/admin/eventos', {
    method: 'POST',
    token,
    json: {
      nombre: `Smoke Asignacion ${now}`,
      tipo: 'campamento',
      descripcion: 'Evento temporal para smoke de asignaciones',
      precio_base: 99,
      fecha_inicio: '2026-08-10',
      fecha_fin: '2026-08-12',
      localizacion: 'Valencia',
      fotos: [],
      otra_informacion: 'Temporal',
    },
  });

  ok(createEventoRes.status === 201, 'POST /api/admin/eventos debe devolver 201 para evento temporal');
  const targetEvento = createEventoRes.data?.evento;
  ok(!!targetEvento?.id, 'Evento temporal debe devolver id');

  const monitorEventosRes = await request(`/api/admin/usuarios/${monitor.id}/eventos`, { token });
  ok(monitorEventosRes.status === 200, 'GET /api/admin/usuarios/:usuarioId/eventos debe devolver 200');

  let assignedMonitorId = monitorEventosRes.data?.data?.[0]?.monitor_id || null;
  let assignedEventoId = targetEvento.id;

  const assignRes = await request('/api/admin/monitores', {
    method: 'POST',
    token,
    json: { usuario_id: monitor.id, evento_id: targetEvento.id, max_jovenes: 12 },
  });

  ok(assignRes.status === 201, 'POST /api/admin/monitores debe devolver 201 para nueva asignación temporal');

  assignedMonitorId = assignRes.data?.monitor?.id || assignedMonitorId;
  assignedEventoId = assignRes.data?.monitor?.evento_id || targetEvento.id;

  const afterAssignRes = await request(`/api/admin/usuarios/${monitor.id}/eventos`, { token });
  ok(afterAssignRes.status === 200, 'GET eventos de monitor tras asignar debe devolver 200');
  ok((afterAssignRes.data?.data || []).some((x) => x.evento_id === targetEvento.id), 'El monitor debe quedar asignado al evento objetivo');

  assignedMonitorId = assignedMonitorId || (afterAssignRes.data?.data || [])[0]?.monitor_id;
  assignedEventoId = assignedEventoId || (afterAssignRes.data?.data || [])[0]?.evento_id;
  ok(!!assignedMonitorId, 'Debe resolverse monitor_id para validar endpoints de asignacion');

  const compatListRes = await request(`/api/admin/monitores/${assignedMonitorId}/eventos`, { token });
  ok(compatListRes.status === 200, 'GET /api/admin/monitores/:monitorId/eventos debe devolver 200');
  ok((compatListRes.data?.data || []).some((x) => x.evento_id === assignedEventoId), 'Listado compat debe incluir la asignación temporal');

  const updateByEventoRes = await request(`/api/admin/monitores/${assignedMonitorId}/eventos/${assignedEventoId}`, {
    method: 'PATCH',
    token,
    json: { max_jovenes: 13, activo: true },
  });
  ok(updateByEventoRes.status === 200, 'PATCH /api/admin/monitores/:monitorId/eventos/:eventoId debe devolver 200');

  const maxJovenesRes = await request(`/api/admin/monitores/${assignedMonitorId}/max-jovenes`, {
    method: 'PATCH',
    token,
    json: { max_jovenes: 14 },
  });

  ok([200, 400].includes(maxJovenesRes.status), 'PATCH max-jovenes debe devolver 200 o 400 (si asignacion_eventos no existe)');
  if (maxJovenesRes.status === 200) {
    ok(Array.isArray(maxJovenesRes.data?.data), 'PATCH max-jovenes (200) debe devolver data[]');
  } else {
    ok(maxJovenesRes.data?.error?.code === 'UNSUPPORTED', 'PATCH max-jovenes (400) debe ser UNSUPPORTED');
  }

  const revocarRes = await request(`/api/admin/monitores/${assignedMonitorId}/eventos/${assignedEventoId}/revocar-enlace`, {
    method: 'POST',
    token,
  });
  ok(revocarRes.status === 200, 'POST revocar-enlace por evento debe devolver 200');
  ok(revocarRes.data?.data?.enlace_token, 'Revocacion debe devolver enlace_token');

  const removeByEventoRes = await request(`/api/admin/monitores/${assignedMonitorId}/eventos/${assignedEventoId}`, {
    method: 'DELETE',
    token,
  });
  ok(removeByEventoRes.status === 200, 'DELETE /api/admin/monitores/:monitorId/eventos/:eventoId debe devolver 200');

  const afterRemoveRes = await request(`/api/admin/usuarios/${monitor.id}/eventos`, { token });
  ok(afterRemoveRes.status === 200, 'GET eventos de monitor tras eliminar asignación debe devolver 200');
  ok(!(afterRemoveRes.data?.data || []).some((x) => x.evento_id === assignedEventoId), 'La asignación eliminada no debe seguir listada');

  const deactivateEventoRes = await request(`/api/admin/eventos/${targetEvento.id}`, {
    method: 'DELETE',
    token,
  });
  ok(deactivateEventoRes.status === 200, 'DELETE /api/admin/eventos/:id debe devolver 200 para cleanup');

  console.log('✅ Smoke API completado');
}

run().catch((error) => {
  console.error('❌ Smoke API falló:', error.message);
  process.exit(1);
});
