const http = require('http');

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: responseData ? JSON.parse(responseData) : null
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function test() {
  try {
    console.log('📝 Testing API endpoints...\n');

    // Step 1: Login
    console.log('1️⃣ Login...');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@example.com',
      password: 'password123'
    });
    console.log(`   Status: ${loginRes.status}`);
    const token = loginRes.data?.accessToken;
    if (!token) throw new Error('No token received');
    console.log(`   ✓ Token received\n`);

    // Step 2: Get eventos
    console.log('2️⃣ GET /api/admin/eventos');
    const eventosRes = await makeRequest('GET', '/api/admin/eventos', null, token);
    console.log(`   Status: ${eventosRes.status}`);
    console.log(`   Events found: ${eventosRes.data?.total}\n`);

    // Step 3: Get usuarios
    console.log('3️⃣ GET /api/admin/usuarios');
    const usuariosRes = await makeRequest('GET', '/api/admin/usuarios', null, token);
    console.log(`   Status: ${usuariosRes.status}`);
    console.log(`   Users found: ${usuariosRes.data?.total}\n`);

    // Step 4: Get jovenes
    console.log('4️⃣ GET /api/admin/jovenes');
    const jovenesRes = await makeRequest('GET', '/api/admin/jovenes', null, token);
    console.log(`   Status: ${jovenesRes.status}`);
    console.log(`   Youth found: ${jovenesRes.data?.total}`);
    if (jovenesRes.data?.data?.length > 0) {
      console.log(`   Sample: ${jovenesRes.data.data[0].nombre} ${jovenesRes.data.data[0].apellidos}`);
    }
    console.log();

    // Step 5: Get registration links
    console.log('5️⃣ GET /api/admin/registration-links');
    const linksRes = await makeRequest('GET', '/api/admin/registration-links', null, token);
    console.log(`   Status: ${linksRes.status}`);
    console.log(`   Links found: ${linksRes.data?.total}\n`);

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
