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
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
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

async function login(email, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    json: { email, password },
  });
  ok(res.status === 200, `Login ${email} debe devolver 200`);
  ok(!!res.data?.accessToken, `Login ${email} debe devolver accessToken`);
  return res.data.accessToken;
}

async function run() {
  console.log('== Smoke requisitos por rol (admin + monitor) ==');

  const baseMonitorEmail = 'monitor1@example.com';
  const baseMonitorPassword = 'password123';

  const adminToken = await login('admin@example.com', 'password123');
  let monitorToken = await login(baseMonitorEmail, baseMonitorPassword);

  const unique = Date.now();
  const tempMonitorEmail = `monitor.req.${unique}@example.com`;
  const tempMonitorName = `Monitor Req ${unique}`;
  const tempMonitorPassword = `ReqPass${unique}`;
  const tempEventoNombre = `Evento Req ${unique}`;
  const changedName = `Monitor One ${unique}`;
  const changedEmail = `monitor1.req.${unique}@example.com`;
  const changedPassword = `NewPass${unique}`;

  let tempMonitorUserId = null;
  let tempMonitorAsignacionId = null;
  let tempEventoId = null;
  let tempJovenId = null;

  try {
    const adminEventos = await request('/api/admin/eventos?incluir_pasados=true', { token: adminToken });
    ok(adminEventos.status === 200, 'Admin debe poder listar eventos');
    ok(Array.isArray(adminEventos.data?.data), 'Admin eventos debe ser array');

    const adminUsuarios = await request('/api/admin/usuarios', { token: adminToken });
    ok(adminUsuarios.status === 200, 'Admin debe poder listar usuarios');
    ok(Array.isArray(adminUsuarios.data?.data), 'Admin usuarios debe ser array');

    const adminJovenes = await request('/api/admin/jovenes', { token: adminToken });
    ok(adminJovenes.status === 200, 'Admin debe poder listar jóvenes');
    ok(Array.isArray(adminJovenes.data?.data), 'Admin jóvenes debe ser array');

    const createEvento = await request('/api/admin/eventos', {
      method: 'POST',
      token: adminToken,
      json: {
        nombre: tempEventoNombre,
        tipo: 'campamento',
        descripcion: 'Evento temporal requisitos',
        precio_base: 88,
        fecha_inicio: '2026-09-10',
        fecha_fin: '2026-09-12',
        localizacion: 'Madrid',
        fotos: [],
        otra_informacion: 'Smoke requisitos',
      },
    });
    ok(createEvento.status === 201, 'Admin debe poder crear evento');
    tempEventoId = createEvento.data?.evento?.id;
    ok(!!tempEventoId, 'Evento temporal debe tener id');

    const updateEvento = await request(`/api/admin/eventos/${tempEventoId}`, {
      method: 'PUT',
      token: adminToken,
      json: {
        nombre: `${tempEventoNombre} Editado`,
        tipo: 'campamento',
        descripcion: 'Evento temporal editado',
        precio_base: 99,
        fecha_inicio: '2026-09-10',
        fecha_fin: '2026-09-13',
        localizacion: 'Sevilla',
        fotos: [],
        otra_informacion: 'Editado',
        activo: true,
      },
    });
    ok(updateEvento.status === 200, 'Admin debe poder modificar evento');

    const createMonitorUser = await request('/api/admin/usuarios', {
      method: 'POST',
      token: adminToken,
      json: {
        email: tempMonitorEmail,
        nombre_mostrado: tempMonitorName,
        rol: 'monitor',
        password_temporal: tempMonitorPassword,
      },
    });
    ok(createMonitorUser.status === 201, 'Admin debe poder crear monitor');
    tempMonitorUserId = createMonitorUser.data?.usuario?.id;
    ok(!!tempMonitorUserId, 'Monitor temporal debe tener id');

    const updateMonitorUser = await request(`/api/admin/usuarios/${tempMonitorUserId}`, {
      method: 'PUT',
      token: adminToken,
      json: {
        email: tempMonitorEmail,
        nombre_mostrado: `${tempMonitorName} Editado`,
        rol: 'monitor',
        activo: true,
      },
    });
    ok(updateMonitorUser.status === 200, 'Admin debe poder modificar monitor');

    const assignMonitor = await request('/api/admin/monitores', {
      method: 'POST',
      token: adminToken,
      json: { usuario_id: tempMonitorUserId, evento_id: tempEventoId, max_jovenes: 5 },
    });
    ok(assignMonitor.status === 201, 'Admin debe poder asignar monitor a evento');
    tempMonitorAsignacionId = assignMonitor.data?.monitor?.id || null;

    const monitorUsers = adminUsuarios.data.data;
    const baseMonitorUser = monitorUsers.find((u) => u.email === baseMonitorEmail);
    ok(!!baseMonitorUser, 'Debe existir monitor1 en seed');

    const baseMonitorEventos = await request(`/api/admin/usuarios/${baseMonitorUser.id}/eventos`, { token: adminToken });
    ok(baseMonitorEventos.status === 200, 'Admin debe ver eventos de monitor1');
    const baseMonitorAsignacion = (baseMonitorEventos.data?.data || [])[0];
    ok(!!baseMonitorAsignacion, 'Monitor1 debe tener al menos una asignación');

    const createJovenAdmin = await request('/api/admin/jovenes', {
      method: 'POST',
      token: adminToken,
      json: {
        nombre: `JovenReq${unique}`,
        apellidos: 'Temporal',
        monitor_id: baseMonitorAsignacion.monitor_id,
        evento_id: baseMonitorAsignacion.evento_id,
      },
    });
    ok(createJovenAdmin.status === 201, 'Admin debe poder crear joven');
    tempJovenId = createJovenAdmin.data?.data?.id;
    ok(!!tempJovenId, 'Joven temporal debe tener id');

    const updateJovenAdmin = await request(`/api/admin/jovenes/${tempJovenId}`, {
      method: 'PATCH',
      token: adminToken,
      json: { nombre: `JovenReq${unique}Editado`, apellidos: 'TemporalEditado' },
    });
    ok(updateJovenAdmin.status === 200, 'Admin debe poder modificar joven');

    const monitorEventos = await request('/api/monitor/eventos', { token: monitorToken });
    ok(monitorEventos.status === 200, 'Monitor debe poder ver sus eventos');
    ok((monitorEventos.data?.data || []).every((e) => e.activo === true), 'Monitor solo debe ver eventos activos');

    const monitorJovenes = await request('/api/monitor/jovenes', { token: monitorToken });
    ok(monitorJovenes.status === 200, 'Monitor debe poder ver sus jóvenes');
    ok((monitorJovenes.data?.data || []).some((j) => j.id === tempJovenId), 'Monitor debe ver el joven asignado a su evento');

    const monitorEditJoven = await request(`/api/monitor/jovenes/${tempJovenId}`, {
      method: 'PATCH',
      token: monitorToken,
      json: { nombre: `JovenReq${unique}Monitor` },
    });
    ok(monitorEditJoven.status === 200, 'Monitor debe poder editar su joven asignado');

    const foreignJoven = await request('/api/admin/jovenes', {
      method: 'POST',
      token: adminToken,
      json: {
        nombre: `JovenForaneo${unique}`,
        apellidos: 'OtroMonitor',
        monitor_id: tempMonitorAsignacionId,
        evento_id: tempEventoId,
      },
    });
    ok(foreignJoven.status === 201, 'Debe poder crearse joven foráneo de control');
    const foreignJovenId = foreignJoven.data?.data?.id;

    const monitorNoAccess = await request(`/api/monitor/jovenes/${foreignJovenId}`, { token: monitorToken });
    ok(monitorNoAccess.status === 403, 'Monitor no debe ver jóvenes de otro monitor');

    const profileUpdate = await request('/api/auth/me/profile', {
      method: 'PATCH',
      token: monitorToken,
      json: { nombre_mostrado: changedName },
    });
    ok(profileUpdate.status === 200, 'Monitor debe poder actualizar su perfil');

    const emailUpdate = await request('/api/auth/me/email', {
      method: 'PATCH',
      token: monitorToken,
      json: { password: baseMonitorPassword, newEmail: changedEmail },
    });
    ok(emailUpdate.status === 200, 'Monitor debe poder cambiar su email');

    const passwordUpdate = await request('/api/auth/me/password', {
      method: 'PATCH',
      token: monitorToken,
      json: { currentPassword: baseMonitorPassword, newPassword: changedPassword },
    });
    ok(passwordUpdate.status === 200, 'Monitor debe poder cambiar su contraseña');

    monitorToken = await login(changedEmail, changedPassword);

    const revertEmail = await request('/api/auth/me/email', {
      method: 'PATCH',
      token: monitorToken,
      json: { password: changedPassword, newEmail: baseMonitorEmail },
    });
    ok(revertEmail.status === 200, 'Debe poder revertirse el email del monitor');

    const revertPassword = await request('/api/auth/me/password', {
      method: 'PATCH',
      token: monitorToken,
      json: { currentPassword: changedPassword, newPassword: baseMonitorPassword },
    });
    ok(revertPassword.status === 200, 'Debe poder revertirse la contraseña del monitor');

    const revertProfile = await request('/api/auth/me/profile', {
      method: 'PATCH',
      token: monitorToken,
      json: { nombre_mostrado: 'Monitor Uno' },
    });
    ok(revertProfile.status === 200, 'Debe poder revertirse el nombre del monitor');

    const deleteJovenAdmin = await request(`/api/admin/jovenes/${tempJovenId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    ok(deleteJovenAdmin.status === 200, 'Admin debe poder borrar joven');

    if (foreignJovenId) {
      await request(`/api/admin/jovenes/${foreignJovenId}`, {
        method: 'DELETE',
        token: adminToken,
      });
    }

    const deleteEvento = await request(`/api/admin/eventos/${tempEventoId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    ok(deleteEvento.status === 200, 'Admin debe poder borrar/desactivar evento');

    const deleteMonitorUser = await request(`/api/admin/usuarios/${tempMonitorUserId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    ok(deleteMonitorUser.status === 200, 'Admin debe poder borrar monitor');

    console.log('✅ Smoke requisitos por rol completado');
  } finally {
    if (tempJovenId) {
      await request(`/api/admin/jovenes/${tempJovenId}`, { method: 'DELETE', token: adminToken });
    }
    if (tempEventoId) {
      await request(`/api/admin/eventos/${tempEventoId}`, { method: 'DELETE', token: adminToken });
    }
    if (tempMonitorUserId) {
      await request(`/api/admin/usuarios/${tempMonitorUserId}`, { method: 'DELETE', token: adminToken });
    }
  }
}

run().catch((error) => {
  console.error('❌ Smoke requisitos por rol falló:', error.message);
  process.exit(1);
});
