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

  let data = null;
  const text = await response.text();
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
  console.log('== E2E ParoikiApp ==');

  let adminToken;
  let monitorToken;
  let createdEventoId;
  let createdUserId;

  console.log('\n[1] Login monitor y organizador');
  {
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      json: { email: 'admin@example.com', password: 'password123' },
    });
    ok(adminLogin.status === 200, 'Login admin debe devolver 200');
    ok(adminLogin.data?.accessToken, 'Login admin debe devolver accessToken');
    adminToken = adminLogin.data.accessToken;

    const monitorLogin = await request('/api/auth/login', {
      method: 'POST',
      json: { email: 'monitor1@example.com', password: 'password123' },
    });
    ok(monitorLogin.status === 200, 'Login monitor debe devolver 200');
    ok(monitorLogin.data?.accessToken, 'Login monitor debe devolver accessToken');
    monitorToken = monitorLogin.data.accessToken;

    console.log('  OK logins');
  }

  console.log('\n[2] Creacion y modificacion de evento');
  {
    const now = Date.now();
    const createEvento = await request('/api/admin/eventos', {
      method: 'POST',
      token: adminToken,
      json: {
        nombre: `Evento Test ${now}`,
        tipo: 'campamento',
        descripcion: 'Evento creado por test',
        precio_base: 123.45,
        fecha_inicio: '2026-08-01',
        fecha_fin: '2026-08-05',
        localizacion: 'Madrid',
        fotos: ['https://example.com/foto-1.jpg'],
        otra_informacion: 'Info de prueba',
      },
    });

    ok(createEvento.status === 201, 'Crear evento debe devolver 201');
    ok(createEvento.data?.evento?.id, 'Crear evento debe devolver id');
    createdEventoId = createEvento.data.evento.id;

    const updateEvento = await request(`/api/admin/eventos/${createdEventoId}`, {
      method: 'PUT',
      token: adminToken,
      json: {
        nombre: `Evento Test ${now} Mod`,
        tipo: 'campamento',
        descripcion: 'Evento modificado por test',
        precio_base: 130,
        fecha_inicio: '2026-08-02',
        fecha_fin: '2026-08-06',
        localizacion: 'Barcelona',
        fotos: ['https://example.com/foto-2.jpg'],
        otra_informacion: 'Otra info',
        activo: true,
      },
    });

    ok(updateEvento.status === 200, 'Modificar evento debe devolver 200');
    ok(updateEvento.data?.evento?.nombre?.includes('Mod'), 'Evento debe quedar modificado');

    console.log('  OK evento create/update');
  }

  console.log('\n[3] Creacion, modificacion y borrado de usuario');
  {
    const now = Date.now();
    const createUser = await request('/api/admin/usuarios', {
      method: 'POST',
      token: adminToken,
      json: {
        email: `tmp.user.${now}@example.com`,
        nombre_mostrado: 'Usuario Temporal',
        rol: 'monitor',
        password_temporal: 'TempPass123!'
      },
    });

    ok(createUser.status === 201, 'Crear usuario debe devolver 201');
    ok(createUser.data?.usuario?.id, 'Crear usuario debe devolver id');
    createdUserId = createUser.data.usuario.id;

    const updateUser = await request(`/api/admin/usuarios/${createdUserId}`, {
      method: 'PUT',
      token: adminToken,
      json: {
        email: `tmp.user.${now}.mod@example.com`,
        nombre_mostrado: 'Usuario Temporal Modificado',
        rol: 'monitor',
        activo: true,
      },
    });

    ok(updateUser.status === 200, 'Modificar usuario debe devolver 200');
    ok(updateUser.data?.usuario?.nombre_mostrado?.includes('Modificado'), 'Usuario debe quedar modificado');

    const deleteUser = await request(`/api/admin/usuarios/${createdUserId}`, {
      method: 'DELETE',
      token: adminToken,
    });

    ok(deleteUser.status === 200, 'Borrar usuario debe devolver 200');
    console.log('  OK usuario create/update/delete');
  }

  console.log('\n[4] Creacion de link de registro de jovenes');
  {
    const users = await request('/api/admin/usuarios', { token: adminToken });
    ok(users.status === 200, 'Listar usuarios debe devolver 200');
    const monitor = (users.data?.data || []).find((u) => u.email === 'monitor1@example.com');
    ok(!!monitor, 'Debe existir monitor1@example.com');

    const assign = await request('/api/admin/monitores', {
      method: 'POST',
      token: adminToken,
      json: { usuario_id: monitor.id, evento_id: createdEventoId },
    });

    ok([201, 409].includes(assign.status), 'Asignacion debe devolver 201 o 409');

    const links = await request('/api/admin/registration-links', { token: adminToken });
    ok(links.status === 200, 'Listar links debe devolver 200');

    const found = (links.data?.data || []).some(
      (l) => l.evento_id === createdEventoId && l.monitor_email === 'monitor1@example.com'
    );
    ok(found, 'Debe existir link para monitor1 en evento creado');

    console.log('  OK links de registro');
  }

  console.log('\n[5] Mostrar eventos publicos en index (API publica)');
  {
    const publicEventos = await request('/api/public/eventos');
    ok(publicEventos.status === 200, 'API publica de eventos debe devolver 200');
    const foundPublic = (publicEventos.data?.data || []).some((e) => e.id === createdEventoId);
    ok(foundPublic, 'El evento creado debe aparecer en publico');
    console.log('  OK eventos publicos');
  }

  console.log('\n[6] Test de inyeccion');
  {
    const sqlInjectionLogin = await request('/api/auth/login', {
      method: 'POST',
      json: { email: "' OR 1=1 --", password: 'whatever' },
    });

    ok([400, 401].includes(sqlInjectionLogin.status), 'Inyeccion SQL en login no debe funcionar');

    const tokenInjection = await request("/register/'%20OR%201=1%20--");
    ok(tokenInjection.status !== 500, 'Inyeccion en token no debe tumbar servidor');

    console.log('  OK inyeccion');
  }

  console.log('\n[7] Test DDOS / rate limit login');
  {
    const attempts = [];
    for (let i = 0; i < 20; i += 1) {
      attempts.push(await request('/api/auth/login', {
        method: 'POST',
        json: { email: 'admin@example.com', password: 'wrong-password' },
      }));
    }

    const got429 = attempts.some((r) => r.status === 429);
    const noServerErrors = attempts.every((r) => r.status !== 500);
    ok(noServerErrors, 'Intentos DDOS no deben provocar 500');

    if (!got429) {
      const expectedStatuses = attempts.every((r) => [400, 401].includes(r.status));
      ok(expectedStatuses, 'Sin 429, los intentos deben ser bloqueados por validacion/autenticacion sin errores');
    }

    console.log('  OK rate limit / DDOS basico');
  }

  console.log('\n[8] Seguridad de datos sensibles y ficheros adjuntos');
  {
    const users = await request('/api/admin/usuarios', { token: adminToken });
    ok(users.status === 200, 'Usuarios debe devolver 200');
    const sampleUser = users.data?.data?.[0] || {};
    ok(!('password_hash' in sampleUser), 'No debe exponerse password_hash');

    const monitorJovenes = await request('/api/monitor/jovenes', { token: monitorToken });
    ok(monitorJovenes.status === 200, 'Monitor jovenes debe devolver 200');
    const sampleJoven = monitorJovenes.data?.data?.[0] || {};
    ok(!('ruta_interna' in sampleJoven), 'No debe exponerse ruta_interna en jovenes');

    const noAuthDoc = await request('/api/documentos/00000000-0000-0000-0000-000000000000');
    ok(noAuthDoc.status === 401, 'Documento sin auth debe devolver 401');

    const monitorDoc = await request('/api/documentos/00000000-0000-0000-0000-000000000000', { token: monitorToken });
    ok([403, 404].includes(monitorDoc.status), 'Documento no autorizado/inexistente debe devolver 403/404');

    const bodyText = JSON.stringify(monitorDoc.data || {});
    ok(!bodyText.includes('password_hash'), 'No debe exponer hashes sensibles');
    ok(!bodyText.includes('refresh_token_hash'), 'No debe exponer refresh token hash');

    console.log('  OK seguridad datos/documentos');
  }

  console.log('\n✅ Suite E2E completada');
}

run().catch((error) => {
  console.error('\n❌ Fallo en suite E2E:', error.message);
  process.exit(1);
});
