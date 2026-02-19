const http = require('http');

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: responseData ? JSON.parse(responseData) : null,
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
    console.log('Testing Monitor Panel...\n');

    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'monitor1@example.com',
      password: 'password123',
    });

    const token = loginRes.data?.accessToken;
    if (!token) throw new Error('No token received');

    const jovenesRes = await makeRequest('GET', '/api/monitor/jovenes', null, token);
    console.log('Jovenes:', jovenesRes.status, jovenesRes.data?.total);

    const linkRes = await makeRequest('GET', '/api/monitor/registration-link', null, token);
    console.log('Links:', linkRes.status, linkRes.data?.total);

    console.log('Monitor tests passed');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

test();
