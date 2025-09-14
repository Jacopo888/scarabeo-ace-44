#!/usr/bin/env node

/**
 * Script per testare la configurazione CORS del servizio Quackle
 */

const QUACKLE_URL = 'https://service-quackle-production.up.railway.app';

async function testCors(origin) {
  console.log(`\n🧪 Testing CORS with origin: ${origin}`);
  
  try {
    const response = await fetch(`${QUACKLE_URL}/health`, {
      method: 'GET',
      headers: {
        'Origin': origin,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📋 Headers:`);
    console.log(`   - Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin') || 'NOT SET'}`);
    console.log(`   - Access-Control-Allow-Credentials: ${response.headers.get('access-control-allow-credentials') || 'NOT SET'}`);
    console.log(`   - Access-Control-Allow-Methods: ${response.headers.get('access-control-allow-methods') || 'NOT SET'}`);
    console.log(`   - Access-Control-Allow-Headers: ${response.headers.get('access-control-allow-headers') || 'NOT SET'}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`📊 Response: ${JSON.stringify(data, null, 2)}`);
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function testCorsConfig() {
  console.log(`\n🔍 Testing CORS configuration for Quackle service`);
  console.log(`🌐 Service URL: ${QUACKLE_URL}`);
  
  // Test different origins
  const origins = [
    'https://scarabeo-ace-44.lovable.app',
    'https://preview--scarabeo-ace-44.lovable.app', 
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];
  
  for (const origin of origins) {
    await testCors(origin);
  }
  
  // Test CORS config endpoint
  console.log(`\n🔧 Testing CORS config endpoint`);
  try {
    const response = await fetch(`${QUACKLE_URL}/health/cors`);
    const data = await response.json();
    console.log(`📋 CORS Origins configured: ${JSON.stringify(data.allow_origins, null, 2)}`);
  } catch (error) {
    console.log(`❌ Error getting CORS config: ${error.message}`);
  }
  
  // Test debug config endpoint
  console.log(`\n🐛 Testing debug config endpoint`);
  try {
    const response = await fetch(`${QUACKLE_URL}/debug/config`);
    const data = await response.json();
    console.log(`📋 Debug config: ${JSON.stringify(data, null, 2)}`);
  } catch (error) {
    console.log(`❌ Error getting debug config: ${error.message}`);
  }
}

// Run the test
testCorsConfig().catch(console.error);
