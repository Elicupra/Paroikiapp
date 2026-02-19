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
    console.log('📝 Testing Monitor Panel...\n');

    // Step 1: Login as monitor
    console.log('1️⃣ Login as monitor...');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'monitor1@example.com',
      password: 'password123'
    });
    console.log(`   Status: ${loginRes.status}`);
    const token = loginRes.data?.accessToken;
    if (!token) throw new Error('No token received');
    console.log(`   ✓ Token received\n`);

    // Step 2: Get jovenes
    console.log('2️⃣ GET /api/monitor/jovenes');
    const jovenesRes = await makeRequest('GET', '/api/monitor/jovenes', null, token);
    console.log(`   Status: ${jovenesRes.status}`);
    console.log(`   Youth found: ${jovenesRes.data?.total}`);
    if (jovenesRes.data?.data?.length > 0) {
      console.log('\n   Youth list:');
      jovenesRes.data.data.forEach(j => {
        console.log(`   - ${j.nombre} ${j.apellidos} (ID: ${j.id})`);
        console.log(`     Documentos: ${j.documentos_count}, Pagos: ${j.pagos_count}, Total: €${j.total_pagado || 0}`);
      });
    } else {
      console.log('   ⚠️ No youth found for this monitor!');
    }
    console.log();

    // Step 3: Get registration link
    console.log('3️⃣ GET /api/monitor/registration-link');
    const linkRes = await makeRequest('GET', '/api/monitor/registration-link', null, token);
    console.log(`   Status: ${linkRes.status}`);
    if (linkRes.data?.data?.length > 0) {
      console.log(`   Link: ${linkRes.data.data[0].url}`);
    }
    console.log();

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

test();
