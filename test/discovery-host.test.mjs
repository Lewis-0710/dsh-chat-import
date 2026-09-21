// test/discovery-host.test.mjs — 发现层 host 适配的有界读取（readHead / readTail）
//
// readTail 是「大 transcript 只取尾部元数据」的路径（claude/kimi 的 contextTokens）：
// DSH fs 没有 seek API，只能流式读到底、在内存里滚动保留末尾 maxBytes。实现从
//「每块 (tail+chunk).slice(-n) 全量复制」改成「chunks 数组 + 头部淘汰 + 最后一次
// join/slice」，这里锁住行为：结果恒为末尾 maxBytes、跨块与单块超大两种形态都对，
// 且无 streamText 时回退 readText 的行为不变。
import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { makeDiscoveryHost } from '../lib/discovery-host.mjs'

// 伪 fs：files 是 path → 文本；streamText 按 chunkSize 分块 yield（模拟宿主流式读）。
function fakeCtx(files, { chunkSize = 64, withStream = true } = {}) {
  const fs = {
    async resolve(p) { return p },
    async stat(p) {
      if (!files.has(p)) return null
      return { type: 'file', size: Buffer.byteLength(files.get(p)), mtimeMs: 1 }
    },
    async readText(p) { return files.has(p) ? files.get(p) : null },
    async listDir() { return [] },
  }
  if (withStream) {
    fs.streamText = async function* streamText(p) {
      const text = files.get(p)
      if (text === undefined) throw new Error('ENOENT')
      for (let i = 0; i < text.length; i += chunkSize) yield text.slice(i, i + chunkSize)
    }
  }
  return { fs }
}

test('readTail：跨多块流式读取时返回末尾 maxBytes（滚动窗口不累积未淘汰块）', async () => {
  const text = Array.from({ length: 1000 }, (_, i) => String.fromCharCode(97 + (i % 26))).join('')
  const host = makeDiscoveryHost(fakeCtx(new Map([['/f.jsonl', text]]), { chunkSize: 64 }))
  const tail = await host.readTail('/f.jsonl', 100)
  assert.equal(tail, text.slice(-100))
  assert.equal(tail.length, 100)
})

test('readTail：单个 chunk 自身就超过 maxBytes 时取该块末尾（不丢尾部）', async () => {
  const text = 'x'.repeat(5000) + 'TAILMARKER'
  const host = makeDiscoveryHost(fakeCtx(new Map([['/f.jsonl', text]]), { chunkSize: 100000 }))
  const tail = await host.readTail('/f.jsonl', 32)
  assert.equal(tail.length, 32)
  assert.ok(tail.endsWith('TAILMARKER'))
})

test('readTail：文本不足 maxBytes 时原样返回；缺失文件返回 null', async () => {
  const host = makeDiscoveryHost(fakeCtx(new Map([['/small.jsonl', 'short text']])))
  assert.equal(await host.readTail('/small.jsonl', 4096), 'short text')
  assert.equal(await host.readTail('/missing.jsonl', 4096), null)
})

test('readTail：无 streamText（测试 mock / 降级 fs）时回退 readText 截尾，行为与旧版一致', async () => {
  const text = 'y'.repeat(300) + 'END'
  const host = makeDiscoveryHost(fakeCtx(new Map([['/f.jsonl', text]]), { withStream: false }))
  assert.equal(await host.readTail('/f.jsonl', 10), text.slice(-10))
  assert.equal(await host.readTail('/f.jsonl', 10000), text)
})

test('readHead：有界读头（取到 maxBytes 即停），无 streamText 时回退截断', async () => {
  const text = 'z'.repeat(1000)
  const streamed = makeDiscoveryHost(fakeCtx(new Map([['/f.jsonl', text]]), { chunkSize: 64 }))
  assert.equal((await streamed.readHead('/f.jsonl', 100)).length, 100)
  assert.equal(await streamed.readHead('/f.jsonl', 5000), text)
  const fallback = makeDiscoveryHost(fakeCtx(new Map([['/f.jsonl', text]]), { withStream: false }))
  assert.equal((await fallback.readHead('/f.jsonl', 100)).length, 100)
})
