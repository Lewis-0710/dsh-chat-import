// transfer.test.mjs — 「导入到」非 DSH 目标的转投管线（lib/transfer.mjs）
//
// 这里不走完整 apply：直接用注入的 importItem 钉住「导入结果 → 转投行为」的分支，
// 以及导出失败 / 导入被跳过 / 批量展开这些**必须大声**的路径（集成路径见
// index.test.mjs 的「面板「导入到」」三例）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isTransferTarget, transferDiscoveryItem, transferHint, TRANSFER_TARGETS } from '../lib/transfer.mjs'

const item = (over = {}) => ({ format: 'claude', sourcePath: 'D:\\demo\\sess-1.jsonl', sessionIds: [], target: 'opencode', ...over })

// 极小 ctx：导出器只用到 fs.writeText / fs.resolve 与 sessionPersistence（后者缺席时
// 导出会以「sessionPersistence 不可用」失败，正是「导出失败」分支要覆盖的形态）。
function fakeCtx({ persistence } = {}) {
  const writes = []
  return {
    writes,
    fs: {
      async resolve(path) { return { targetKey: path, displayPath: path } },
      async writeText(target, content) { writes.push({ path: target.targetKey, content }); return { path: target.targetKey } },
      async stat() { return undefined },
      async readText() { throw new Error('FS_NOT_FOUND') },
    },
    get(service) { return service === 'sessionPersistence' ? persistence : undefined },
  }
}

test('目标白名单与落点提示：dsh 不在转投目标里，四个外部目标都有提示', () => {
  assert.deepEqual(TRANSFER_TARGETS, ['claude', 'codex', 'kimi', 'opencode'])
  assert.equal(isTransferTarget('dsh'), false)
  assert.equal(isTransferTarget('zcode'), false)
  for (const t of TRANSFER_TARGETS) assert.equal(isTransferTarget(t), true)
  assert.match(transferHint('opencode', '/tmp/a.opencode.json'), /opencode import/)
  assert.match(transferHint('claude', ''), /--resume|projects/)
  assert.equal(transferHint('dsh', 'x'), '')
})

test('未知目标 / 缺 importItem → 直接抛错（不静默降级回 DSH 导入）', async () => {
  const ctx = fakeCtx()
  await assert.rejects(() => transferDiscoveryItem(ctx, item({ target: 'zcode' }), { importItem: async () => ({}) }), /未知导入目标/)
  await assert.rejects(() => transferDiscoveryItem(ctx, item(), {}), /需要 importItem/)
})

test('导入被跳过（无会话产出）→ 转投报 failed 并带上跳过原因，而不是空的成功', async () => {
  const ctx = fakeCtx()
  const out = await transferDiscoveryItem(ctx, item(), {
    importItem: async () => ({ mode: 'single', status: 'skipped', sessionId: 'none', skipReason: 'auxiliary transcript' }),
  })
  assert.equal(out.status, 'failed')
  assert.equal(out.transferred, 0)
  assert.equal(out.failed, 1)
  assert.match(out.error, /auxiliary transcript/)
  assert.deepEqual(out.files, [])
  assert.equal(ctx.writes.length, 0, '没有产出任何文件')
})

test('导出失败（会话读不到）→ 逐条记 failed + error，且不撤回（无会话可撤）', async () => {
  const ctx = fakeCtx({ persistence: undefined })
  const out = await transferDiscoveryItem(ctx, item(), {
    importItem: async () => ({ mode: 'single', status: 'imported', sessionId: 'import-sess-1' }),
  })
  assert.equal(out.status, 'failed')
  assert.equal(out.failed, 1)
  assert.equal(out.transferred, 0)
  assert.equal(out.purged, 0)
  assert.equal(out.files.length, 1)
  assert.equal(out.files[0].status, 'failed')
  assert.match(out.files[0].error, /不可用|不存在/)
})

test('批量形态：逐条展开转投，跳过/失败的条目不进转投（不产出空文件）', async () => {
  const ctx = fakeCtx()
  const seen = []
  const out = await transferDiscoveryItem(ctx, item({ format: 'opencode' }), {
    // 批量导入结果里混着 skipped 与 failed 条目：它们没有可导出的会话
    importItem: async () => ({
      mode: 'batch',
      results: [
        { path: 'D:\\demo\\a', status: 'skipped', sessionId: 'none' },
        { path: 'D:\\demo\\b', status: 'failed' },
        { path: 'D:\\demo\\c', status: 'imported', sessionId: 'import-c' },
      ],
    }),
  })
  assert.equal(out.mode, 'batch')
  // 唯一可转投的会话导出失败（无 persistence）→ 记一条 failed，且不会为 skipped/failed 造条目
  assert.equal(out.files.length, 1)
  assert.equal(out.files[0].sessionId, 'import-c')
  assert.equal(out.files[0].sourcePath, 'D:\\demo\\c')
  assert.equal(seen.length, 0)
})

test('导出成功但撤回失败 → 保留会话并把原因带到结果（kept + purgeError，不静默）', async () => {
  // 用一个真的能被导出的最小 DSH 会话：persistence 提供 list/readFrom，导出走 opencode
  const store = new Map()
  const sessionId = 'import-sess-keep'
  store.set(sessionId, {
    meta: { id: sessionId, version: 3, createdAt: 1785000000000, cwd: 'D:\\demo\\proj', isSeeded: false, delegationDepth: 0 },
    events: [
      { type: 'user/message', seq: 0, time: 1785000000001, data: { id: 'u', role: 'user', content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } } },
      { type: 'assistant/message', seq: 1, time: 1785000000002, data: { turn: 0, step: 1, stream: [], message: { id: 'a', role: 'assistant', content: [{ type: 'text', text: 'ok' }] } } },
    ],
  })
  const persistence = {
    async list() { return [...store.values()].map((s) => s.meta) },
    async readFrom(id) { const s = store.get(id); if (!s) throw new Error('unknown'); return { meta: s.meta, events: s.events } },
  }
  const ctx = fakeCtx({ persistence })
  // registry 目录用临时目录；会话不在 registry 里 → deleteImportedSession 会抛
  //「会话不在 imports registry」，正好模拟撤回失败
  const registryDir = mkdtempSync(join(tmpdir(), 'dsh-transfer-'))
  const out = await transferDiscoveryItem(ctx, item(), {
    registryDir,
    importItem: async () => ({ mode: 'single', status: 'imported', sessionId }),
  })
  assert.equal(out.transferred, 1)
  assert.equal(out.purged, 0)
  assert.equal(out.kept, 1)
  assert.equal(out.files[0].kept, true)
  assert.match(out.files[0].purgeError, /registry|非法/)
  // 文件确实写出来了（导出本身成功），撤回失败不掩盖这一点
  assert.equal(ctx.writes.length, 1)
  assert.match(ctx.writes[0].path, /\.opencode\.json$/)
  assert.equal(JSON.parse(ctx.writes[0].content).info.id.startsWith('ses_'), true)
})
