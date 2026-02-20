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

async function run() {
  console.log('== Smoke API: flujo joven/perfil/ficha ==');

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    json: { email: 'admin@example.com', password: 'password123' },
  });
  ok(adminLogin.status === 200, 'Login admin debe devolver 200');
  const adminToken = adminLogin.data?.accessToken;
  ok(!!adminToken, 'Login admin debe devolver token');

  const monitorLogin = await request('/api/auth/login', {
    method: 'POST',
    json: { email: 'monitor1@example.com', password: 'password123' },
  });
  ok(monitorLogin.status === 200, 'Login monitor debe devolver 200');
  const monitorToken = monitorLogin.data?.accessToken;
  ok(!!monitorToken, 'Login monitor debe devolver token');

  const linksRes = await request('/api/admin/registration-links', { token: adminToken });
  ok(linksRes.status === 200, 'GET registration-links debe devolver 200');
  const monitorLink = (linksRes.data?.data || []).find((l) => l.monitor_email === 'monitor1@example.com');
  ok(!!monitorLink?.token, 'Debe existir token de registro para monitor1');

  const eventInfoRes = await request(`/register/${monitorLink.token}`);
  ok(eventInfoRes.status === 200, 'GET /register/:token debe devolver 200');

  const now = Date.now();
  const nombre = `Joven${now}`;
  const apellidos = 'Smoke';

  const registerRes = await request(`/register/${monitorLink.token}/joven`, {
    method: 'POST',
    json: { nombre, apellidos },
  });
  ok(registerRes.status === 201, 'POST /register/:token/joven debe devolver 201');
  const jovenId = registerRes.data?.joven?.id;
  const fichaToken = registerRes.data?.acceso?.token;
  ok(!!jovenId, 'Registro debe devolver joven.id');
  ok(!!fichaToken, 'Registro debe devolver token de ficha');

  const fichaRes = await request(`/ficha/${fichaToken}`);
  ok(fichaRes.status === 200, 'GET /ficha/:token debe devolver 200');
  ok(fichaRes.data?.data?.id === jovenId, 'Ficha debe corresponder al joven creado');

  const fichaPatchRes = await request(`/ficha/${fichaToken}`, {
    method: 'PATCH',
    json: { nombre: `${nombre}Editado` },
  });
  ok(fichaPatchRes.status === 200, 'PATCH /ficha/:token debe devolver 200');

  const formData = new FormData();
  formData.append('tipo', 'autorizacion_paterna');
  formData.append('archivo', new Blob(['autorizacion test'], { type: 'text/plain' }), 'autorizacion.txt');

  const uploadRes = await request(`/ficha/${fichaToken}/documento`, {
    method: 'POST',
    body: formData,
  });
  ok(uploadRes.status === 201, 'POST /ficha/:token/documento debe devolver 201');

  const fichaAfterUploadRes = await request(`/ficha/${fichaToken}`);
  ok(fichaAfterUploadRes.status === 200, 'GET ficha tras upload debe devolver 200');
  const docs = fichaAfterUploadRes.data?.data?.documentos || [];
  ok(docs.length > 0, 'Ficha debe listar documentos tras upload');

  const monitorJovenDetalleRes = await request(`/api/monitor/jovenes/${jovenId}`, { token: monitorToken });
  ok(monitorJovenDetalleRes.status === 200, 'Monitor debe poder ver detalle de su joven');

  const monitorDocsRes = await request(`/api/monitor/jovenes/${jovenId}/documentos`, { token: monitorToken });
  ok(monitorDocsRes.status === 200, 'Monitor debe poder ver documentos de su joven');

  const adminPerfilRes = await request(`/api/admin/jovenes/${jovenId}/perfil`, { token: adminToken });
  ok(adminPerfilRes.status === 200, 'Admin debe poder ver perfil completo del joven');
  ok((adminPerfilRes.data?.data?.documentos || []).length > 0, 'Perfil admin debe incluir documentos');

  console.log('✅ Smoke flujo joven/perfil/ficha completado');
}

run().catch((error) => {
  console.error('❌ Smoke flujo joven/perfil/ficha falló:', error.message);
  process.exit(1);
});
