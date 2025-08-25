#!/usr/bin/env node

/**
 * Concurrent Singleton Test Script
 * Tests the AutomationEngine singleton under concurrent load to verify zombie cron fix
 */

const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const CONCURRENT_REQUESTS = 10;
const TEST_ENDPOINTS = [
  '/api/automation/recipes',
  '/api/automation/debug',
  '/api/automation/control',
  '/api/automation/monitor',
  '/api/automation/audit'
];

// Helper function to make HTTP requests
function makeRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body && method !== 'GET') {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData,
            endpoint: endpoint,
            method: method
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
            endpoint: endpoint,
            method: method,
            parseError: true
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        error: error.message,
        endpoint: endpoint,
        method: method
      });
    });

    if (body && method !== 'GET') {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Test 1: Rapid concurrent GET requests to different endpoints
async function testConcurrentGets() {
  console.log('\n🔥 TEST 1: Concurrent GET requests to trigger singleton access');
  console.log(`Making ${CONCURRENT_REQUESTS} concurrent requests across ${TEST_ENDPOINTS.length} endpoints...`);
  
  const promises = [];
  
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const endpoint = TEST_ENDPOINTS[i % TEST_ENDPOINTS.length];
    promises.push(makeRequest(endpoint));
  }
  
  try {
    const results = await Promise.all(promises);
    const successful = results.filter(r => r.status && r.status < 400);
    const failed = results.filter(r => !r.status || r.status >= 400);
    
    console.log(`✅ Successful requests: ${successful.length}`);
    console.log(`❌ Failed requests: ${failed.length}`);
    
    if (failed.length > 0) {
      console.log('Failed requests:', failed.slice(0, 3));
    }
    
    return successful.length >= CONCURRENT_REQUESTS * 0.8; // 80% success rate
  } catch (error) {
    console.error('❌ Concurrent test failed:', error);
    return false;
  }
}

// Test 2: Use audit API to check singleton state
async function testSingletonState() {
  console.log('\n🔍 TEST 2: Checking singleton state via audit API');
  
  try {
    const auditResult = await makeRequest('/api/automation/audit');
    
    if (auditResult.status === 200 && auditResult.data.success) {
      const analysis = auditResult.data.data.analysis;
      console.log(`📊 Unique instances found: ${analysis.uniqueInstancesFound}`);
      console.log(`📊 Instance IDs: ${analysis.instanceIds.join(', ')}`);
      console.log(`📊 Total jobs across instances: ${analysis.totalJobsAcrossInstances}`);
      console.log(`📊 Max jobs in single instance: ${analysis.maxJobsInSingleInstance}`);
      console.log(`📊 Zombie risk: ${analysis.potentialZombieRisk}`);
      console.log(`📊 Recommendation: ${analysis.recommendation}`);
      
      return !analysis.potentialZombieRisk;
    } else {
      console.error('❌ Audit API call failed:', auditResult);
      return false;
    }
  } catch (error) {
    console.error('❌ Singleton state check failed:', error);
    return false;
  }
}

// Test 3: Test rapid automation operations
async function testAutomationOperations() {
  console.log('\n⚡ TEST 3: Rapid automation operations to stress singleton');
  
  const operations = [
    { endpoint: '/api/automation/recipes', method: 'GET' },
    { endpoint: '/api/automation/debug', method: 'GET' },
    { endpoint: '/api/automation/monitor', method: 'GET' },
    { endpoint: '/api/automation/audit', method: 'GET' },
    { endpoint: '/api/automation/recipes', method: 'GET' },
  ];
  
  try {
    // Make rapid sequential calls (simulates user interaction)
    const results = [];
    for (const op of operations) {
      const result = await makeRequest(op.endpoint, op.method);
      results.push(result);
      // Small delay to simulate real usage
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const successful = results.filter(r => r.status && r.status < 400);
    console.log(`✅ Sequential operations successful: ${successful.length}/${operations.length}`);
    
    return successful.length === operations.length;
  } catch (error) {
    console.error('❌ Automation operations test failed:', error);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 ZOMBIE CRON FIX VALIDATION TESTS');
  console.log('====================================');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}`);
  
  const results = {
    concurrentGets: false,
    singletonState: false,
    automationOperations: false
  };
  
  // Run all tests
  results.concurrentGets = await testConcurrentGets();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Cooling period
  
  results.singletonState = await testSingletonState();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Cooling period
  
  results.automationOperations = await testAutomationOperations();
  
  // Final summary
  console.log('\n📋 TEST RESULTS SUMMARY');
  console.log('========================');
  console.log(`Concurrent GET requests: ${results.concurrentGets ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Singleton state check: ${results.singletonState ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Automation operations: ${results.automationOperations ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result === true);
  console.log(`\nOVERALL: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\n🎉 ZOMBIE CRON FIX VALIDATION SUCCESSFUL!');
    console.log('The idempotent restoration fix is working correctly.');
  } else {
    console.log('\n⚠️  VALIDATION FAILED - Further investigation needed.');
  }
  
  return allPassed;
}

// Check if server is running before starting tests
async function checkServerHealth() {
  try {
    const health = await makeRequest('/api/automation/debug');
    return health.status === 200;
  } catch (error) {
    console.error('❌ Server not accessible at localhost:3001');
    console.error('Please ensure push-blaster is running before executing tests.');
    return false;
  }
}

// Execute tests
(async () => {
  const serverUp = await checkServerHealth();
  if (serverUp) {
    const success = await runTests();
    process.exit(success ? 0 : 1);
  } else {
    process.exit(1);
  }
})();
