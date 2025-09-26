#!/usr/bin/env node
/**
 * CI smoke test per /best-move allineato alla modalità vs quackle
 * - Usa board come mappa di coordinate 1-based (o vuota {})
 * - Asserisce HTTP 200, engine_fallback=false, move_type!='pass', tiles presenti
 */

import assert from 'node:assert/strict'
import { request } from 'node:http'

const BASE = process.env.QUACKLE_BASE || 'http://localhost:8080'

function httpPostJson(path, body) {
  const url = new URL(path, BASE)
  const payload = Buffer.from(JSON.stringify(body))
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(payload.length),
      },
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const buf = Buffer.concat(chunks).toString('utf8')
        resolve({ status: res.statusCode, body: buf })
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function parseJsonSafe(s){
  try { return JSON.parse(s) } catch { return null }
}

async function runCase(label, body) {
  const { status, body: resp } = await httpPostJson('/best-move', body)
  assert.equal(status, 200, `${label}: atteso HTTP 200, ottenuto ${status} -> ${resp}`)
  const json = parseJsonSafe(resp)
  assert.ok(json && typeof json === 'object', `${label}: risposta non JSON: ${resp}`)
  assert.equal(json.engine_fallback, false, `${label}: engine_fallback deve essere false: ${resp}`)
  assert.ok(json.move_type !== 'pass', `${label}: move_type non deve essere pass: ${resp}`)
  assert.ok(Array.isArray(json.tiles) && json.tiles.length > 0, `${label}: tiles deve essere non vuoto: ${resp}`)
}

async function main(){
  // Caso A: board vuota + rack robusto con una blank
  await runCase('A', { rack: 'FALREI?', board: {} })
  // Caso B: centro occupato 'A' + rack con due blank
  await runCase('B', { rack: 'HELLO??', board: { '8,8': { letter: 'A', isBlank: false } } })
  console.log('Smoke test CI OK')
}

main().catch((err) => { console.error(err?.stack || String(err)); process.exit(1) })
