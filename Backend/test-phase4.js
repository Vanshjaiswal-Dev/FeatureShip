const http = require('http');

const BASE_URL = 'http://localhost:5000/api/v1';

async function runTests() {
  console.log('--- Starting Phase 4 (SSE Sync) Tests ---');
  try {
    // 1. Register a test user
    const uniqueEmail = `testuser_${Date.now()}@test.com`;
    let res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: uniqueEmail, password: 'password123', organizationName: 'Test Org' })
    });
    let data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to register');
    const token = data.token;

    // 2. Create a Project
    res = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: 'SSE Test App' })
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create project');
    const projectId = data.id;
    const devEnv = data.environments.find(e => e.name === 'Development');
    const clientKey = devEnv.clientKey;
    console.log(`✅ Project created. Dev clientKey: ${clientKey}`);

    // 3. Create a Feature Flag
    res = await fetch(`${BASE_URL}/projects/${projectId}/flags`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        name: 'Realtime Feature', 
        key: 'realtime-feature',
        type: 'BOOLEAN'
      })
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create flag');
    const flagId = data.id;
    console.log(`✅ Feature Flag created.`);

    // 4. Connect to SSE Stream
    console.log('\n4. Connecting to SSE Stream...');
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/v1/client/stream',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${clientKey}`,
        'Accept': 'text/event-stream'
      }
    };

    const req = http.request(options, (streamRes) => {
      console.log(`   SSE Connected. Status: ${streamRes.statusCode}`);
      streamRes.on('data', (chunk) => {
        const msg = chunk.toString();
        console.log(`\n📬 [SSE RECEIVED]:\n${msg}`);
        
        // If we get the update event, we can exit
        if (msg.includes('flag_update') || msg.includes('flag_updated')) {
            console.log('🎉 REALTIME UPDATE RECEIVED SUCCESSFULLY!');
            process.exit(0);
        }
      });
      streamRes.on('end', () => {
         console.log('SSE connection closed');
      });
    });
    
    req.on('error', (e) => {
      console.error(`problem with request: ${e.message}`);
    });
    req.end();

    // Wait a little bit to ensure connection is established
    await new Promise(r => setTimeout(r, 2000));

    // 5. Update Feature Flag to trigger SSE
    console.log('\n5. Updating Feature Flag in DB to trigger stream...');
    res = await fetch(`${BASE_URL}/projects/${projectId}/flags/${flagId}/environments/${devEnv.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ isActive: true, rolloutPercentage: 100 })
    });
    if (!res.ok) throw new Error('Failed to update flag');
    console.log('✅ Flag updated. Waiting for SSE event...');

    // Wait some time, if we don't exit, then it failed
    await new Promise(r => setTimeout(r, 5000));
    console.log('❌ Timeout: Did not receive SSE update in time.');
    process.exit(1);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

runTests();
