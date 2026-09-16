// codex-chain.test.mjs — Codex 分页 rollout（issue #57）链解析与拼接单测
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  codexThreadIdFromName, codexNameTimestamp, groupCodexThreads, sortCodexPages,
  codexChainStat, codexSessionsAncestor,
} from '../lib/codex.mjs'
import { convertCodexJsonl } from '../lib/convert/codex.mjs'

const THREAD = '0f1e2d3c-4b5a-6978-8901-2abcdef01234'
const PAGE_B = '7c6d5e4f-0011-2233-4455-66778899aabb'

const metaLine = (id, extra = {}) => JSON.stringify({
  timestamp: '2026-09-14T10:54:34.000Z', type: 'session_meta',
  payload: { id, cwd: '/home/u/proj', timestamp: '2026-09-14T10:54:34.000Z', ...extra },
})
const userItem = (text, ts) => JSON.stringify({ timestamp: ts, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } })
const asstItem = (text, ts) => JSON.stringify({ timestamp: ts, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] } })

test('codexThreadIdFromName：取文件名第一个 UUID（分页后缀在前 UUID 之后）', () => {
  assert.equal(codexThreadIdFromName(`rollout-2026-09-14T10-54-33-${THREAD}.jsonl`), THREAD)
  assert.equal(codexThreadIdFromName(`rollout-2026-09-15T19-55-00-${THREAD}_${PAGE_B}.jsonl`), THREAD)
  assert.equal(codexThreadIdFromName('a.jsonl'), undefined)
})

test('codexNameTimestamp：取文件名内嵌时间戳；无则 null', () => {
  assert.equal(codexNameTimestamp(`rollout-2026-09-14T10-54-33-${THREAD}.jsonl`), '2026-09-14T10-54-33')
  assert.equal(codexNameTimestamp('a.jsonl'), null)
})

test('groupCodexThreads：同 thread 的分页归一组；无 UUID 文件各自成单页组', () => {
  const groups = groupCodexThreads([
    { path: '/s/2026/09/15/rollout-2026-09-15T19-55-00-' + THREAD + '_' + PAGE_B + '.jsonl', name: 'rollout-2026-09-15T19-55-00-' + THREAD + '_' + PAGE_B + '.jsonl' },
    { path: '/s/2026/09/14/rollout-2026-09-14T10-54-33-' + THREAD + '.jsonl', name: 'rollout-2026-09-14T10-54-33-' + THREAD + '.jsonl' },
    { path: '/s/2026/09/16/a.jsonl', name: 'a.jsonl' },
  ])
  assert.equal(groups.size, 2)
  const chain = groups.get(THREAD)
  // 页序：按文件名时间戳升序（首页在前）
  assert.deepEqual(chain.map((p) => p.nameTs), ['2026-09-14T10-54-33', '2026-09-15T19-55-00'])
  assert.ok(groups.has('file:/s/2026/09/16/a.jsonl'))
})

test('sortCodexPages：mtime 回退（无文件名时间戳时）', () => {
  const sorted = sortCodexPages([
    { path: '/b', name: 'b.jsonl', nameTs: null },
    { path: '/a', name: 'a.jsonl', nameTs: null },
  ], (p) => (p.path === '/a' ? 100 : 200))
  assert.deepEqual(sorted.map((p) => p.path), ['/a', '/b'])
})

test('codexChainStat：size 求和、version 拼接（新增一页即变化）', () => {
  const s1 = codexChainStat([{ size: 10, version: 'v-a' }, { size: 20, version: 'v-b' }])
  assert.equal(s1.size, 30)
  assert.equal(s1.version, 'v-a|v-b')
  const s2 = codexChainStat([{ size: 10, version: 'v-a' }, { size: 20, version: 'v-b' }, { size: 5, version: 'v-c' }])
  assert.notEqual(s1.version, s2.version)
  assert.notEqual(s1.size, s2.size)
})

test('codexSessionsAncestor：向上找 sessions 目录；找不到返回 null（调用方退化处理）', () => {
  assert.equal(codexSessionsAncestor('/home/u/.codex/sessions/2026/09/14/rollout-x.jsonl'), '/home/u/.codex/sessions')
  assert.equal(codexSessionsAncestor('/tmp/rollout-x.jsonl'), null)
})

test('拼接转换：两页合成一个会话（第二条 session_meta 被忽略、轮次连续）', () => {
  const pageA = [
    metaLine(THREAD),
    userItem('第一问', '2026-09-14T10:55:00.000Z'),
    asstItem('答一', '2026-09-14T10:55:10.000Z'),
  ].join('\n')
  const pageB = [
    metaLine(THREAD, {
      history_mode: 'paginated',
      history_base: { thread_id: THREAD, end_ordinal_exclusive: 3, end_byte_offset: 300 },
    }),
    userItem('第二问', '2026-09-15T19:56:00.000Z'),
    asstItem('答二', '2026-09-15T19:56:10.000Z'),
  ].join('\n')

  const out = convertCodexJsonl(pageA + '\n' + pageB, { sourcePath: '/s/rollout-a.jsonl' })
  assert.equal(out.meta.id, 'import-' + THREAD)
  assert.equal(out.turns.length, 2)
  assert.deepEqual(out.turns.map((t) => t.prompt), ['第一问', '第二问'])
  // 会话时间取首页 meta 的 timestamp（第二页的 meta 被忽略）
  assert.equal(out.meta.createdAt, Date.parse('2026-09-14T10:54:34.000Z'))
})
