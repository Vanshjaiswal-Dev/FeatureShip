const { FeatureShipClient } = require('./dist/index.js');
const http = require('http');

const BASE_URL = 'http://localhost:5000/api/v1';

async function runTests() {
  console.log('--- Starting Phase 5 (SDK) Tests ---');
  try {
    // 1. Setup Data on Backend
    const uniqueEmail = `sdktest_${Date.now()}@test.com`;
    let res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SDK User', email: uniqueEmail, password: 'password123', organizationName: 'SDK Org' })
    });
    let data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to register');
    const token = data.token;

    res = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: 'SDK Test App' })
    });
    data = await res.json();
    const projectId = data.id;
    const devEnv = data.environments.find(e => e.name === 'Development');
    const clientKey = devEnv.clientKey;

    res = await fetch(`${BASE_URL}/projects/${projectId}/flags`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        name: 'SDK Feature', 
        key: 'sdk-feature',
        type: 'BOOLEAN'
      })
    });
    data = await res.json();
    const flagId = data.id;
    console.log(`✅ SDK Test Project & Flag created. clientKey: ${clientKey}`);

    // 2. Initialize SDK
    console.log('\n2. Initializing FeatureShip SDK...');
    const client = new FeatureShipClient(clientKey, { baseUrl: BASE_URL });

    await new Promise((resolve, reject) => {
      client.on('ready', (flags) => {
        console.log(`✅ SDK Initialized and Ready. Initial flags:`, flags);
        resolve();
      });
      client.on('error', (err) => {
        console.error('SDK Error', err);
        reject(err);
      });
      client.init();
    });

    // 3. Verify synchronous flag evaluation
    let isSdkFeatureActive = client.getFlag('sdk-feature');
    console.log(`   getFlag('sdk-feature') === ${isSdkFeatureActive}`);
    if (isSdkFeatureActive !== false) throw new Error('Expected flag to be false initially');

    // 4. Trigger Server-side update
    console.log('\n3. Triggering Flag Update via Dashboard API...');
    res = await fetch(`${BASE_URL}/projects/${projectId}/flags/${flagId}/environments/${devEnv.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ isActive: true, rolloutPercentage: 100 })
    });

    // 5. Wait for SDK to receive SSE event
    console.log('\n4. Waiting for SDK to automatically sync...');
    await new Promise((resolve) => {
      client.on('update', (key, config) => {
        console.log(`✅ SDK Received Update! Key: ${key}, Config:`, config);
        
        // Check new synchronous evaluation
        if (client.getFlag('sdk-feature') !== true) {
            console.error('getFlag returned wrong value after update');
            process.exit(1);
        } else {
            console.log(`   getFlag('sdk-feature') === ${client.getFlag('sdk-feature')}`);
            console.log('\n🎉 SDK SYNCHRONIZATION TESTS PASSED SUCCESSFULLY! 🎉');
            client.close();
            resolve();
        }
      });
    });

    // Need to give time for process to exit smoothly
    setTimeout(() => {
        process.exit(0);
    }, 500);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

runTests();
