// goose.test.mjs — Goose 源转换核心单元测试（自包含合成数据，不掺真实会话）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convertGooseJson, gooseDataDir, gooseSessionsDir, gooseDefaultDbPath } from '../lib/convert/goose.mjs'
import { SESSION_FORMAT_VERSION } from '../lib/convert/core.mjs'
import { join } from 'node:path'

// 配对不变量：每个 tool/call 都有对应 tool/result，且 result 的 sourceEventSeqs
// 指向其 tool/call 的 seq（synthesizeSession 兜底保证，见 core.mjs）。
function assertToolPairing(events) {
  const calls = events.filter((e) => e.type === 'tool/call')
  const results = events.filter((e) => e.type === 'tool/result')
  assert.equal(results.length, calls.length, `tool/call(${calls.length}) 与 tool/result(${results.length}) 数量一致`)
  const resultByCall = new Map(results.map((r) => [r.data.message.content[0].toolCallId, r]))
  for (const c of calls) {
    const r = resultByCall.get(c.data.callId)
    assert.ok(r, `tool/result 存在 for call ${c.data.callId}`)
    assert.deepEqual(r.sourceEventSeqs, [c.seq], `call ${c.data.callId} 的 result 指向其 seq`)
  }
}

const SID = '20260422_3'
const CWD = '/home/u/repo'
const TS = 1745343730000

// goose 的 messages 一行一条消息，content_json 是整个块数组
function msg(role, content, over = {}) {
  return { role, createdTimestamp: TS, content, ...over }
}
function textBlock(text) {
  return { type: 'text', text }
}
function toolRequest(id, name, args) {
  return { type: 'toolRequest', id, tool_call: { status: 'success', value: { name, arguments: args } } }
}
function toolResponse(id, value, status = 'success') {
  return {
    type: 'toolResponse',
    id,
    tool_result: status === 'error' ? { status: 'error', error: String(value) } : { status: 'success', value },
  }
}
function session(messages, over = {}) {
  return JSON.stringify({
    id: SID, name: '修登录页分页', description: '', workingDir: CWD,
    providerName: 'anthropic', sessionType: 'user', parentSessionId: '',
    createdAt: TS, updatedAt: TS + 1000, messages, ...over,
  })
}

test('简单轮次：user 文本开轮、标题取 name、cwd/创建时间落 meta', () => {
  const out = convertGooseJson(session([
    msg('user', [textBlock('修一下登录页分页')]),
    msg('assistant', [textBlock('已修好。')]),
  ]), { createdAt: TS, sourcePath: '/home/u/.local/share/goose/sessions/sessions.db' })
  assert.equal(out.meta.version, SESSION_FORMAT_VERSION)
  assert.equal(out.meta.id, 'import-' + SID)
  assert.equal(out.meta.sourceId, SID)
  assert.equal(out.meta.cwd, CWD)
  assert.equal(out.meta.createdAt, TS)
  assert.equal(out.turns.length, 1)
  assert.equal(out.turns[0].prompt, '修一下登录页分页')
  assert.equal(out.messages, 2) // user + assistant（环境变更声明不计）
  assert.equal(out.toolCalls, 0)
  assert.equal(out.title, '修登录页分页')
  // 有显式标题 → 钉 session/title 事件
  assert.equal(out.events.filter((e) => e.type === 'session/title').length, 1)
})

test('thinking + toolRequest（信封 value）+ toolResponse → 同一步推理/调用/结果且配对', () => {
  const out = convertGooseJson(session([
    msg('user', [textBlock('读一下 a.ts')]),
    msg('assistant', [
      { type: 'thinking', thinking: '先读文件', signature: '' },
      toolRequest('call_1', 'read_file', { path: 'a.ts' }),
    ]),
    msg('user', [toolResponse('call_1', { content: [{ type: 'text', text: 'export const a = 1' }] })]),
    msg('assistant', [textBlock('只有一个导出。')]),
  ]), { createdAt: TS })
  assert.equal(out.turns.length, 1) // 结果载体不开新轮
  assert.equal(out.turns[0].steps.length, 2)
  const [s1] = out.turns[0].steps
  assert.deepEqual(s1.content[0], { type: 'reasoning', text: '先读文件' })
  assert.deepEqual(s1.toolCalls, [{ type: 'tool-call', id: 'call_1', name: 'read_file', arguments: '{"path":"a.ts"}' }])
  assert.deepEqual(s1.toolResults[0].content, [{ type: 'text', text: 'export const a = 1' }])
  assert.equal(s1.toolResults[0].isError, false)
  assert.equal(out.toolCalls, 1)
  assert.equal(out.droppedToolResults, 0)
  assertToolPairing(out.events)
})

test('toolResponse 的 error 信封与 value.isError 都记为错误；字符串结果原样保留', () => {
  const out = convertGooseJson(session([
    msg('user', [textBlock('跑两条命令')]),
    msg('assistant', [toolRequest('c_ok', 'bash', { cmd: 'a' }), toolRequest('c_bad', 'bash', { cmd: 'b' })]),
    // 结果分两条消息到达（乱序：先 bad 后 ok）
    msg('user', [toolResponse('c_bad', 'command failed', 'error')]),
    msg('user', [toolResponse('c_ok', 'ok')]),
  ]), { createdAt: TS })
  const step = out.turns[0].steps[0]
  assert.deepEqual(step.toolResults.map((r) => r.toolCallId), ['c_ok', 'c_bad']) // 按 call 顺序对齐
  const byId = new Map(step.toolResults.map((r) => [r.toolCallId, r]))
  assert.equal(byId.get('c_bad').isError, true)
  assert.deepEqual(byId.get('c_bad').content, [{ type: 'text', text: 'command failed' }])
  assert.deepEqual(byId.get('c_ok').content, [{ type: 'text', text: 'ok' }])
  assertToolPairing(out.events)
})

test('value.isError=true（信封 status 仍 success）也标记为错误结果', () => {
  const out = convertGooseJson(session([
    msg('user', [textBlock('跑')]),
    msg('assistant', [toolRequest('c1', 'bash', {})]),
    msg('user', [toolResponse('c1', { content: [{ type: 'text', text: 'boom' }], isError: true })]),
  ]), { createdAt: TS })
  assert.equal(out.turns[0].steps[0].toolResults[0].isError, true)
})

test('旧形状 {type:reasoning} 兼容；redactedThinking / image / 交互块计入 skippedBlocks', () => {
  const out = convertGooseJson(session([
    msg('user', [textBlock('问题')]),
    msg('assistant', [
      { type: 'reasoning', text: '旧形状推理' },
      { type: 'redactedThinking', data: 'opaque' },
      { type: 'image', data: 'base64' },
      toolRequest('c1', 'bash', {}),
    ]),
    msg('user', [
      toolResponse('c1', 'ok'),
      { type: 'actionRequired', action: 'confirm' },
      { type: 'toolConfirmationRequest', id: 'x' },
    ]),
  ]), { createdAt: TS })
  const step = out.turns[0].steps[0]
  assert.deepEqual(step.content[0], { type: 'reasoning', text: '旧形状推理' })
  assert.equal(out.skippedBlocks, 4) // redactedThinking + image（assistant）+ actionRequired + toolConfirmationRequest（user）
  assertToolPairing(out.events)
})

test('结果载体附带的人类正文挂到该步，不开新轮也不丢文本', () => {
  const out = convertGooseJson(session([
    msg('user', [textBlock('跑一下')]),
    msg('assistant', [toolRequest('c1', 'bash', {})]),
    msg('user', [toolResponse('c1', 'ok'), textBlock('顺便把这个也改了')]),
  ]), { createdAt: TS })
  assert.equal(out.turns.length, 1)
  const step = out.turns[0].steps[0]
  assert.equal(step.toolResults.length, 1)
  assert.deepEqual(step.content.filter((b) => b.type === 'text'), [{ type: 'text', text: '顺便把这个也改了' }])
})

test('孤儿 toolResponse 丢弃并计数；重复 callId 只保留首次', () => {
  const orphan = convertGooseJson(session([
    msg('user', [textBlock('问题')]),
    msg('assistant', [textBlock('回答')]),
    msg('user', [toolResponse('call_missing', '来路不明')]),
  ]), { createdAt: TS })
  assert.equal(orphan.droppedToolResults, 1)
  assert.equal(orphan.events.filter((e) => e.type === 'tool/result').length, 0)

  const dup = convertGooseJson(session([
    msg('user', [textBlock('看看')]),
    msg('assistant', [toolRequest('dup', 'read_file', { path: 'a.ts' })]),
    msg('assistant', [toolRequest('dup', 'read_file', { path: 'a.ts' }), textBlock('重发')]),
    msg('user', [toolResponse('dup', '内容')]),
  ]), { createdAt: TS })
  assert.equal(dup.droppedDuplicateCalls, 1)
  assert.equal(dup.toolCalls, 1)
  assert.deepEqual(dup.turns[0].steps[1].content.map((b) => b.type), ['text'])
  assertToolPairing(dup.events)
})

test('status:error 的 toolRequest（无 value）跳过并计数', () => {
  const out = convertGooseJson(session([
    msg('user', [textBlock('问题')]),
    msg('assistant', [
      { type: 'toolRequest', id: 'bad', tool_call: { status: 'error', error: 'invalid arguments' } },
      textBlock('我来换个方式'),
    ]),
  ]), { createdAt: TS })
  assert.equal(out.toolCalls, 0)
  assert.equal(out.skippedBlocks, 1)
  assert.deepEqual(out.turns[0].steps[0].content, [{ type: 'text', text: '我来换个方式' }])
})

test('子代理 / 隐藏会话不单独成会话', () => {
  const sub = convertGooseJson(session([
    msg('user', [textBlock('子任务')]),
    msg('assistant', [textBlock('完成')]),
  ], { sessionType: 'sub_agent', parentSessionId: '20260422_1' }), { createdAt: TS })
  assert.equal(sub.meta, null)
  assert.match(sub.skipReason, /^Goose sub_agent session/)
  assert.equal(sub.events.length, 0)

  const hidden = convertGooseJson(session([], { sessionType: 'hidden' }), { createdAt: TS })
  assert.match(hidden.skipReason, /^Goose hidden session/)
})

test('标题回退：name 空则用 description，都空则首问兜底（不钉事件）', () => {
  const byDescription = convertGooseJson(session([
    msg('user', [textBlock('随便问问')]),
    msg('assistant', [textBlock('嗯')]),
  ], { name: '', description: '遗留描述标题' }), { createdAt: TS })
  assert.equal(byDescription.title, '遗留描述标题')
  assert.equal(byDescription.events.filter((e) => e.type === 'session/title').length, 1)

  const byPrompt = convertGooseJson(session([
    msg('user', [textBlock('首个提问当作标题')]),
    msg('assistant', [textBlock('好')]),
  ], { name: '', description: '' }), { createdAt: TS })
  assert.equal(byPrompt.title, '首个提问当作标题')
  assert.equal(byPrompt.events.filter((e) => e.type === 'session/title').length, 0)
})

test('系统提示词只在开关开启时收集为上下文注入', () => {
  const raw = session([
    msg('user', [textBlock('问题')]),
    msg('assistant', [textBlock('答')]),
  ], { systemPrompt: '你是 Goose。' })
  const hasText = (out, needle) => out.events.some((e) => e.data && Array.isArray(e.data.content)
    && e.data.content.some((b) => typeof b.text === 'string' && b.text.includes(needle)))
  assert.equal(hasText(convertGooseJson(raw, { createdAt: TS }), '你是 Goose。'), false)
  assert.equal(hasText(convertGooseJson(raw, { createdAt: TS, importSystemPrompt: true }), '你是 Goose。'), true)
})

test('创建时间兜底优先级：args.createdAt > 会话 createdAt > 首条消息时间', () => {
  const byArgs = convertGooseJson(session([
    msg('user', [textBlock('问')]),
    msg('assistant', [textBlock('答')]),
  ]), { createdAt: 1700000000000 })
  assert.equal(byArgs.meta.createdAt, 1700000000000)

  const bySession = convertGooseJson(session([
    msg('user', [textBlock('问')]),
    msg('assistant', [textBlock('答')]),
  ]), {})
  assert.equal(bySession.meta.createdAt, TS)

  const byMessage = convertGooseJson(JSON.stringify({
    id: SID, name: 'n', workingDir: CWD, createdAt: null, messages: [msg('user', [textBlock('问')]), msg('assistant', [textBlock('答')])],
  }), {})
  assert.equal(byMessage.meta.createdAt, TS)
})

test('非 Goose 结构（无 messages 数组 / 非法 JSON）→ skipReason，不产出事件', () => {
  const noMessages = convertGooseJson(JSON.stringify({ id: SID, rows: [] }))
  assert.equal(noMessages.meta, null)
  assert.equal(noMessages.skipReason, 'not a Goose session (no messages array)')

  const bad = convertGooseJson('{not json')
  assert.equal(bad.skipReason, 'not a Goose session (invalid JSON)')
})

test('路径解析：GOOSE_PATH_ROOT 仅绝对路径生效，三平台默认根各自正确', () => {
  const home = join('home', 'u')
  const p = join   // 本机平台口径（跨平台断言用 posix.join/win32.join 显式指定）
  assert.equal(gooseDataDir(home, { GOOSE_PATH_ROOT: join('rel', 'root') }, process.platform),
    p(home, '.local', 'share', 'goose'))
  assert.equal(gooseDataDir(home, { GOOSE_PATH_ROOT: 'D:\\g' }, 'win32'), 'D:\\g\\data')
  assert.equal(gooseDataDir('/h/u', { GOOSE_PATH_ROOT: '/mnt/d/g' }, 'linux'), '/mnt/d/g/data')
  assert.equal(gooseSessionsDir(home, {}, process.platform), p(home, '.local', 'share', 'goose', 'sessions'))
  assert.equal(gooseSessionsDir('/h/u', {}, 'darwin'), '/h/u/Library/Application Support/Block/goose/sessions')
  assert.equal(gooseSessionsDir('C:\\Users\\u', { APPDATA: 'C:\\Users\\u\\AppData\\Roaming' }, 'win32'),
    'C:\\Users\\u\\AppData\\Roaming\\Block\\goose\\data\\sessions')
  assert.equal(gooseDefaultDbPath(home, {}, process.platform), p(home, '.local', 'share', 'goose', 'sessions', 'sessions.db'))
})
