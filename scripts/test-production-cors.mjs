#!/usr/bin/env node

/**
 * Script per testare la configurazione CORS del servizio Quackle in produzione
 * specificamente per il dominio preview--scarabeo-ace-44.lovable.app
 */

const QUACKLE_URL = 'https://service-quackle-production.up.railway.app';
const TEST_ORIGIN = 'https://preview--scarabeo-ace-44.lovable.app';

async function testCors(origin, endpoint = '/health') {
  console.log(`\n🧪 Testing CORS with origin: ${origin} on ${endpoint}`);
  
  try {
    const response = await fetch(`${QUACKLE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Origin': origin,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📋 CORS Headers:`);
    console.log(`   - Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin') || 'NOT SET'}`);
    console.log(`   - Access-Control-Allow-Credentials: ${response.headers.get('access-control-allow-credentials') || 'NOT SET'}`);
    console.log(`   - Access-Control-Allow-Methods: ${response.headers.get('access-control-allow-methods') || 'NOT SET'}`);
    console.log(`   - Access-Control-Allow-Headers: ${response.headers.get('access-control-allow-headers') || 'NOT SET'}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`📊 Response: ${JSON.stringify(data, null, 2)}`);
      return true;
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

async function testPreflight(origin) {
  console.log(`\n🔄 Testing CORS Preflight for ${origin}`);
  
  try {
    const response = await fetch(`${QUACKLE_URL}/best-move`, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log(`✅ Preflight Status: ${response.status}`);
    console.log(`📋 Preflight Headers:`);
    console.log(`   - Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin') || 'NOT SET'}`);
    console.log(`   - Access-Control-Allow-Methods: ${response.headers.get('access-control-allow-methods') || 'NOT SET'}`);
    console.log(`   - Access-Control-Allow-Headers: ${response.headers.get('access-control-allow-headers') || 'NOT SET'}`);
    console.log(`   - Access-Control-Max-Age: ${response.headers.get('access-control-max-age') || 'NOT SET'}`);
    
    return response.ok;
    
  } catch (error) {
    console.log(`❌ Preflight Error: ${error.message}`);
    return false;
  }
}

async function testPostRequest(origin) {
  console.log(`\n📤 Testing POST request for ${origin}`);
  
  try {
    const response = await fetch(`${QUACKLE_URL}/best-move`, {
      method: 'POST',
      headers: {
        'Origin': origin,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        board: {},
        rack: "HELLO",
        difficulty: "medium"
      })
    });
    
    console.log(`✅ POST Status: ${response.status}`);
    console.log(`📋 POST CORS Headers:`);
    console.log(`   - Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin') || 'NOT SET'}`);
    console.log(`   - Access-Control-Allow-Credentials: ${response.headers.get('access-control-allow-credentials') || 'NOT SET'}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`📊 POST Response: ${JSON.stringify(data, null, 2)}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`❌ POST Error Response: ${errorText}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ POST Error: ${error.message}`);
    return false;
  }
}

async function testProductionCors() {
  console.log(`\n🔍 Testing CORS configuration for Quackle service in production`);
  console.log(`🌐 Service URL: ${QUACKLE_URL}`);
  console.log(`🎯 Test Origin: ${TEST_ORIGIN}`);
  
  // Test 1: Health check
  const healthOk = await testCors(TEST_ORIGIN, '/health');
  
  // Test 2: CORS config endpoint
  const corsConfigOk = await testCors(TEST_ORIGIN, '/health/cors');
  
  // Test 3: Preflight request
  const preflightOk = await testPreflight(TEST_ORIGIN);
  
  // Test 4: POST request
  const postOk = await testPostRequest(TEST_ORIGIN);
  
  // Summary
  console.log(`\n📊 Test Summary:`);
  console.log(`   - Health Check: ${healthOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - CORS Config: ${corsConfigOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Preflight: ${preflightOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - POST Request: ${postOk ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = healthOk && corsConfigOk && preflightOk && postOk;
  console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log(`\n🎉 CORS is properly configured for ${TEST_ORIGIN}!`);
    console.log(`   The frontend should now be able to communicate with the Quackle service.`);
  } else {
    console.log(`\n⚠️  CORS configuration needs attention.`);
    console.log(`   Check the service logs and CORS_ORIGINS configuration.`);
  }
}

// Run the test
testProductionCors().catch(console.error);
