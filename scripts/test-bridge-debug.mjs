#!/usr/bin/env node

/**
 * Script per testare e debuggare il bridge Quackle
 */

const QUACKLE_URL = process.env.QUACKLE_BASE || 'https://tilesword-quackle.onrender.com';

async function testBridgeDebug() {
  console.log(`\n🔍 Testing Quackle Bridge Debug`);
  console.log(`🌐 Service URL: ${QUACKLE_URL}`);
  
  // Test 1: Health check per vedere lo stato del bridge
  console.log(`\n1️⃣ Health Check:`);
  try {
    const healthResponse = await fetch(`${QUACKLE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log(`✅ Status: ${healthResponse.status}`);
    console.log(`📊 Health Data:`, JSON.stringify(healthData, null, 2));
  } catch (error) {
    console.log(`❌ Health Error: ${error.message}`);
  }
  
  // Test 2: Debug config per vedere la configurazione del bridge
  console.log(`\n2️⃣ Debug Config:`);
  try {
    const debugResponse = await fetch(`${QUACKLE_URL}/debug/config`);
    const debugData = await debugResponse.json();
    console.log(`✅ Status: ${debugResponse.status}`);
    console.log(`📊 Debug Data:`, JSON.stringify(debugData, null, 2));
  } catch (error) {
    console.log(`❌ Debug Error: ${error.message}`);
  }
  
  // Test 3: Test con rack vuoto (dovrebbe funzionare anche con fallback)
  console.log(`\n3️⃣ Test with Empty Rack:`);
  try {
    const emptyResponse = await fetch(`${QUACKLE_URL}/best-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board: {},
        rack: "",
        difficulty: "medium"
      })
    });
    const emptyData = await emptyResponse.json();
    console.log(`✅ Status: ${emptyResponse.status}`);
    console.log(`📊 Empty Rack Response:`, JSON.stringify(emptyData, null, 2));
  } catch (error) {
    console.log(`❌ Empty Rack Error: ${error.message}`);
  }
  
  // Test 4: Test con rack con lettere (dovrebbe generare mosse reali)
  console.log(`\n4️⃣ Test with Real Rack:`);
  try {
    const realResponse = await fetch(`${QUACKLE_URL}/best-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board: {},
        rack: "HELLO",
        difficulty: "medium"
      })
    });
    const realData = await realResponse.json();
    console.log(`✅ Status: ${realResponse.status}`);
    console.log(`📊 Real Rack Response:`, JSON.stringify(realData, null, 2));
    
    // Analisi della risposta
    if (realData.engine_fallback) {
      console.log(`⚠️  WARNING: Engine is using fallback mode!`);
      console.log(`   This means the GADDAG/DAWG files are not being loaded properly.`);
    } else {
      console.log(`✅ SUCCESS: Engine is using real Quackle with GADDAG/DAWG!`);
    }
    
    if (realData.tiles && realData.tiles.length > 0) {
      console.log(`✅ SUCCESS: Generated ${realData.tiles.length} tile moves!`);
    } else {
      console.log(`⚠️  WARNING: No tile moves generated (might be normal for this rack).`);
    }
    
  } catch (error) {
    console.log(`❌ Real Rack Error: ${error.message}`);
  }
  
  // Test 5: Test con board con lettere esistenti
  console.log(`\n5️⃣ Test with Board and Rack:`);
  try {
    const boardResponse = await fetch(`${QUACKLE_URL}/best-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board: {
          "7,7": {"letter": "H", "isBlank": false},
          "8,7": {"letter": "E", "isBlank": false},
          "9,7": {"letter": "L", "isBlank": false},
          "10,7": {"letter": "L", "isBlank": false},
          "11,7": {"letter": "O", "isBlank": false}
        },
        rack: "WORLD",
        difficulty: "medium"
      })
    });
    const boardData = await boardResponse.json();
    console.log(`✅ Status: ${boardResponse.status}`);
    console.log(`📊 Board Response:`, JSON.stringify(boardData, null, 2));
    
    if (boardData.engine_fallback) {
      console.log(`⚠️  WARNING: Engine is using fallback mode!`);
    } else {
      console.log(`✅ SUCCESS: Engine is using real Quackle!`);
    }
    
  } catch (error) {
    console.log(`❌ Board Error: ${error.message}`);
  }
  
  console.log(`\n🎯 Summary:`);
  console.log(`   - If engine_fallback is true, the GADDAG/DAWG files are not loading properly`);
  console.log(`   - If engine_fallback is false, Quackle is working with real lexicon data`);
  console.log(`   - Check the service logs for detailed error messages`);
}

// Run the test
testBridgeDebug().catch(console.error);
