#!/usr/bin/env node
/**
 * CI smoke test unico e robusto per /best-move
 * - Health check preliminare (HTTP 200 e, se presente, engine_ready==true)
 * - Un solo caso ancorato: centro (8,8)='A' + rack HELLO??
 * - Se fallisce (pass/tiles vuote/engine_fallback), tenta un fallback con rack FALREI?
 * - Assert: HTTP 200, engine_fallback=false, move_type!='pass', tiles.length>0, score>0
 */

import assert from 'node:assert/strict'
import { request } from 'node:http'

const BASE = process.env.QUACKLE_BASE || 'http://localhost:8080'

function httpRequest(path, { method = 'GET', body } = {}) {
  const url = new URL(path, BASE)
  const payload = body ? Buffer.from(JSON.stringify(body)) : undefined
  const headers = body ? { 'content-type': 'application/json', 'content-length': String(payload.length) } : {}
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const buf = Buffer.concat(chunks).toString('utf8')
        resolve({ status: res.statusCode, body: buf })
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function parseJsonSafe(s){
  try { return JSON.parse(s) } catch { return null }
}

async function healthCheck() {
  const { status, body } = await httpRequest('/health')
  assert.equal(status, 200, `health: atteso HTTP 200, ottenuto ${status} -> ${body}`)
  const json = parseJsonSafe(body) || {}
  if ('engine_ready' in json) {
    assert.equal(json.engine_ready, true, `health: engine_ready deve essere true: ${body}`)
  }
  if ('strategy_ready' in json) {
    assert.equal(json.strategy_ready, true, `health: strategy_ready deve essere true: ${body}`)
  }
  if ('gaddag_exists' in json) {
    assert.equal(json.gaddag_exists, true, `health: gaddag_exists deve essere true: ${body}`)
  }
  if ('dawg_exists' in json) {
    assert.equal(json.dawg_exists, true, `health: dawg_exists deve essere true: ${body}`)
  }
  if ('gaddag_size' in json) {
    assert.ok((json.gaddag_size|0) > 0, `health: gaddag_size deve essere > 0: ${body}`)
  }
  if ('dawg_size' in json) {
    assert.ok((json.dawg_size|0) > 0, `health: dawg_size deve essere > 0: ${body}`)
  }
}

function validateBestMove(label, resp) {
  const json = parseJsonSafe(resp)
  assert.ok(json && typeof json === 'object', `${label}: risposta non JSON: ${resp}`)
  assert.equal(json.engine_fallback, false, `${label}: engine_fallback deve essere false: ${resp}`)
  assert.ok(json.move_type !== 'pass', `${label}: move_type non deve essere pass: ${resp}`)
  assert.ok(Array.isArray(json.tiles) && json.tiles.length > 0, `${label}: tiles deve essere non vuoto: ${resp}`)
  assert.ok(typeof json.score === 'number' && json.score > 0, `${label}: score deve essere > 0: ${resp}`)
}

async function tryBestMove(label, body) {
  const { status, body: resp } = await httpRequest('/best-move', { method: 'POST', body })
  assert.equal(status, 200, `${label}: atteso HTTP 200, ottenuto ${status} -> ${resp}`)
  validateBestMove(label, resp)
  return resp
}

async function main(){
  await healthCheck()

  const anchor = { '8,8': { letter: 'A', isBlank: false } }
  const primary = { rack: 'HELLO??', board: anchor }
  const fallback = { rack: 'FALREI?', board: anchor }

  try {
    await tryBestMove('primary', primary)
  } catch (e) {
    // Ritenta con rack alternativo robusto
    await tryBestMove('fallback', fallback)
  }

  console.log('Smoke test CI OK')
}

main().catch((err) => { console.error(err?.stack || String(err)); process.exit(1) })
