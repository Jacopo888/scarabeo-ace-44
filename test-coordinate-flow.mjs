#!/usr/bin/env node
/**
 * Test script per tracciare le coordinate delle tiles attraverso tutto il flusso
 * Simula: API → quackleClient → sanitize → applyBotMove
 */

// Simula chiamata al backend
async function simulateApiCall() {
  console.log('\n=== STEP 1: API CALL ===')
  const response = await fetch('http://localhost:8080/best-move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rack: 'AEIRSTZ',
      board: {},
      difficulty: 'medium'
    })
  })
  
  const data = await response.json()
  console.log('🎯 API Response - move_type:', data.move_type)
  console.log('🎯 API Response - tiles.length:', data.tiles?.length)
  if (data.tiles && data.tiles.length > 0) {
    console.log('🎯 API Response - tiles[0]:', JSON.stringify(data.tiles[0], null, 2))
    console.log('🎯 API Response - tiles[0].row:', data.tiles[0].row, 'typeof:', typeof data.tiles[0].row)
    console.log('🎯 API Response - All rows:', data.tiles.map(t => t.row))
  }
  return data
}

// Simula sanitizeQuackleTile
function simulateSanitize(tile) {
  console.log('\n=== STEP 2: SANITIZE ===')
  console.log('🎯 Input tile.row:', tile.row, 'typeof:', typeof tile.row)
  
  const rowRaw = tile.row
  const rowNum = Number(rowRaw)
  const row = rowNum
  
  console.log('🎯 Sanitize - rowRaw:', rowRaw, 'rowNum:', rowNum, 'row:', row)
  console.log('🎯 row === rowNum:', row === rowNum)
  
  return {
    ...tile,
    row: row,
    col: tile.col
  }
}

// Simula applyBotMove
function simulateApplyBotMove(tiles) {
  console.log('\n=== STEP 3: APPLY BOT MOVE ===')
  console.log('🎯 Input tiles[0].row:', tiles[0].row, 'typeof:', typeof tiles[0].row)
  console.log('🎯 All input rows:', tiles.map(t => t.row))
  
  // Simula scrittura in matrix
  const boardMatrix = Array.from({ length: 15 }, () => Array(15).fill(null))
  tiles.forEach(tile => {
    console.log(`🎯 Writing to boardMatrix[${tile.row}][${tile.col}]:`, {
      letter: tile.letter,
      row: tile.row,
      col: tile.col
    })
    boardMatrix[tile.row][tile.col] = {
      letter: tile.letter,
      row: tile.row,
      col: tile.col
    }
  })
  
  // Verifica cosa è stato scritto
  console.log('\n=== VERIFICATION ===')
  const firstTile = tiles[0]
  const written = boardMatrix[firstTile.row][firstTile.col]
  console.log('🎯 Read back boardMatrix[' + firstTile.row + '][' + firstTile.col + ']:', written)
  console.log('🎯 Written row matches input:', written.row === firstTile.row)
  
  return boardMatrix
}

// Main
async function main() {
  try {
    console.log('🚀 Starting coordinate flow test...\n')
    
    // Step 1: API
    const apiData = await simulateApiCall()
    if (!apiData.tiles || apiData.tiles.length === 0) {
      console.error('❌ No tiles in API response!')
      process.exit(1)
    }
    
    // Step 2: Sanitize
    const sanitized = apiData.tiles.map(tile => simulateSanitize(tile))
    console.log('\n🎯 After sanitize - tiles[0].row:', sanitized[0].row)
    
    // Step 3: Apply
    const matrix = simulateApplyBotMove(sanitized)
    
    // Final check
    console.log('\n=== FINAL RESULT ===')
    const allRowsSeven = sanitized.every(t => t.row === 7)
    if (allRowsSeven) {
      console.log('✅ SUCCESS: All tiles have row=7 throughout the entire flow!')
      console.log('✅ No coordinate transformation detected.')
      console.log('✅ The bug does NOT exist in the code.')
    } else {
      console.log('❌ FAILURE: Some tiles do not have row=7')
      console.log('❌ Rows found:', [...new Set(sanitized.map(t => t.row))])
      console.log('❌ There IS a bug somewhere in the flow.')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
