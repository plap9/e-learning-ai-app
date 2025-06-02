const http = require('http');

// Helper function để thực hiện HTTP request
function makeRequest(method, path, data = null) {
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

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testAuthEndpoints() {
  console.log('🚀 Bắt đầu test Authentication Endpoints\n');

  // Test 1: Health Check
  console.log('1️⃣ Testing Health Check...');
  try {
    const health = await makeRequest('GET', '/health');
    console.log(`✅ Health: ${health.status} - ${JSON.stringify(health.data)}\n`);
  } catch (err) {
    console.log(`❌ Health Error: ${err.message}\n`);
  }

  // Test 2: Register new user với email mới
  console.log('2️⃣ Testing Registration...');
  const randomEmail = `test${Date.now()}@example.com`;
  try {
    const register = await makeRequest('POST', '/auth/register', {
      email: randomEmail,
      password: 'Test123456',
      confirmPassword: 'Test123456',
      firstName: 'Nguyen',
      lastName: 'Van Test'
    });
    console.log(`✅ Register: ${register.status} - ${JSON.stringify(register.data)}\n`);
  } catch (err) {
    console.log(`❌ Register Error: ${err.message}\n`);
  }

  // Test 3: Login với email vừa tạo
  console.log('3️⃣ Testing Login...');
  try {
    const login = await makeRequest('POST', '/auth/login', {
      email: randomEmail,
      password: 'Test123456'
    });
    console.log(`✅ Login: ${login.status} - ${JSON.stringify(login.data)}\n`);
    
    // Lưu token để test logout
    global.refreshToken = login.data.refreshToken;
  } catch (err) {
    console.log(`❌ Login Error: ${err.message}\n`);
  }

  // Test 4: Forgot Password
  console.log('4️⃣ Testing Forgot Password...');
  try {
    const forgot = await makeRequest('POST', '/auth/forgot-password', {
      email: randomEmail
    });
    console.log(`✅ Forgot Password: ${forgot.status} - ${JSON.stringify(forgot.data)}\n`);
  } catch (err) {
    console.log(`❌ Forgot Password Error: ${err.message}\n`);
  }

  // Test 5: Resend Verification Email
  console.log('5️⃣ Testing Resend Verification...');
  try {
    const resend = await makeRequest('POST', '/auth/resend-verification-email', {
      email: randomEmail
    });
    console.log(`✅ Resend Verification: ${resend.status} - ${JSON.stringify(resend.data)}\n`);
  } catch (err) {
    console.log(`❌ Resend Verification Error: ${err.message}\n`);
  }

  // Test 6: Logout
  console.log('6️⃣ Testing Logout...');
  try {
    const logout = await makeRequest('POST', '/auth/logout', {
      refreshToken: global.refreshToken || 'dummy-token'
    });
    console.log(`✅ Logout: ${logout.status} - ${JSON.stringify(logout.data)}\n`);
  } catch (err) {
    console.log(`❌ Logout Error: ${err.message}\n`);
  }

  // Test 7: Validation Errors
  console.log('7️⃣ Testing Validation Errors...');
  try {
    const invalidRegister = await makeRequest('POST', '/auth/register', {
      email: 'invalid-email',
      password: '123', // too short
      confirmPassword: '456', // doesn't match
      firstName: '',
      lastName: ''
    });
    console.log(`✅ Validation Test: ${invalidRegister.status} - ${JSON.stringify(invalidRegister.data)}\n`);
  } catch (err) {
    console.log(`❌ Validation Test Error: ${err.message}\n`);
  }

  console.log('🎉 Hoàn thành test tất cả endpoints!');
}

// Chạy test
testAuthEndpoints().catch(console.error); 