// lib/convert/core.mjs — 共享转换核心（纯函数，无宿主依赖）
//
// 与 index.mjs 分离是为了可独立单元测试：本模块不 import 任何 DSH 包。
// 各源格式的 `convertXxx(raw, args)`（见同目录 convert/*.mjs，每个来源一个文件；权威清单
// 是 lib/discovery.mjs 的 FORMATS）把原始 transcript 文本
// 解析成统一的回合中间结构，再交给共享的 synthesizeSession 合成 DSH 事件日志，
// 保证所有源事件纪律一致。

// 宿主会话格式版本（dsh 的 SESSION_FORMAT_VERSION；0.1.5 起为 3）。写进 meta.version，
// 由宿主 header 校验逐字比对——版本不符的 create 会被直接拒绝（"session header
// version must be 3"）。纯函数层取当前宿主的 3 作为默认值；ctx 层落盘前再用宿主
// 实际版本覆盖（见 lib/import-core.mjs 的 applyHostMeta），让插件跟随宿主升级。
export const SESSION_FORMAT_VERSION = 3

export function parseTime(iso) {
  if (typeof iso === 'number') {
    // 数字时间戳：Unix 秒（<1e11）或毫秒（>=1e11）。**必须取整**：ChatGPT 官方导出的
    // create_time 是带小数的秒（如 1767583930.285031），直接 *1000 会得到浮点毫秒，而
    // 宿主校验要求事件 time / header.createdAt 是安全整数（"time must be a safe integer"），
    // 于是整份会话被拒（issue #62 Bug 3）；同一原因还会让 dry-run 预览的 createdAt
    // 违反 output schema 的 integer 声明（同 issue 的 Bug 4）。
    if (!Number.isFinite(iso)) return Date.now()
    const rounded = Math.round(iso < 1e11 ? iso * 1000 : iso)
    return Number.isSafeInteger(rounded) ? rounded : Date.now()
  }
  if (typeof iso === 'string') {
    const n = Date.parse(iso)
    if (Number.isFinite(n)) return n
  }
  return Date.now()
}

// 把源 sessionId 折成合法的 DSH SessionId 片段。
export function mintSessionId(sourceId) {
  const slug = String(sourceId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64)
  return 'import-' + (slug || String(Date.now()))
}

// Claude content block → DSH content block。文本→text、思考→reasoning、工具调用→tool-call。
export function mapContentBlock(block) {
  if (!block) return null
  if (block.type === 'text' && typeof block.text === 'string') return { type: 'text', text: block.text }
  if (block.type === 'thinking' && typeof block.thinking === 'string') return { type: 'reasoning', text: block.thinking }
  if (block.type === 'tool_use') {
    return { type: 'tool-call', id: block.id, name: block.name, arguments: JSON.stringify(block.input ?? {}) }
  }
  return null
}

// 导入上下文注入的正文：环境变更声明 +（开关开启时）原始系统提示词，整体按 dsh 的
// 注入惯例包进 <system-reminder> 信封（caller-owned framing，与引擎 agent-instructions
// 的提示词形态同构：OPEN / 正文 / CLOSE 逐行拼接；正文里的字面 </system-reminder>
// 转义为 <\/system-reminder>，防止源提示词提前闭合信封）。声明放最前、用英文——信封
// 是模型可见框架，英文跨源格式稳定。声明明确告知模型「已迁移到 DSH，工具列表/权限/
// 执行环境以当前会话为准」，防止模型沿用源系统提示词里的旧工具名、旧命令或旧环境
// 约定（这些在 DSH 里不可用/不同）。环境变更声明**总是注入**（不依赖
// importSystemPrompt 开关）——继续会话时模型看到的是迁移后的新环境，旧工具名/命令
// 不再适用；开关开启时各源把原始 system/developer 提示词收集进 systemPrompt，此处
// 附在声明之后。
const SYSTEM_REMINDER_OPEN = '<system-reminder>'
const SYSTEM_REMINDER_CLOSE = '</system-reminder>'

function contextInjectionText(provider, systemPrompt) {
  const src = String(systemPrompt ?? '').trim()
  const label = typeof provider === 'string' && provider ? provider : 'unknown'
  let body = 'Environment change notice: this session was migrated from ' + label
    + ' to DeepSeek Harness (DSH). The current runtime environment, available tool'
    + ' list, permissions, and execution instructions are all governed by the current'
    + ' DSH session; do not reuse tool names, commands, or environment conventions'
    + ' from the source environment.'
  if (src) {
    body += '\n\n--- Original system prompt (for reference only) ---\n' + src
  }
  return [SYSTEM_REMINDER_OPEN, body.replaceAll(SYSTEM_REMINDER_CLOSE, '<\\/system-reminder>'), SYSTEM_REMINDER_CLOSE].join('\n')
}

// 把「回合中间结构」合成平衡的 DSH 事件日志（seq 从 0 连续；surface 事件带
// surfaceOp:'append'；tool/result 用 sourceEventSeqs 关联其 tool/call）。
// turns: [{ prompt, steps: [{ content, toolCalls, toolResults }] }]
// imported: 已废弃——0.8.2 及以前用于日志头导入标记；标记自 0.8.3 起不再写入
//（issue #34，宿主 fail-closed 词汇表），调用方传入的同名参数被忽略。
// systemPrompt: 可选——开关开启（importSystemPrompt）时各源提取的原始系统提示词。
// 无论开关与否，都会把「环境变更声明」作为「上下文注入」user/message（source.kind=
// 'plugin'，plugin='chat-import'）注入会话最前；开关开启时声明后附原始系统提示词。
// 正文按 dsh 惯例包 <system-reminder> 信封（见 contextInjectionText）。声明告知模型：
// 迁移到 DSH 后工具/权限/指令以 DSH 当前会话为准，避免沿用源工具系统提示词里的旧
// 工具名/旧命令（这些在 DSH 里不可用/不同）。
//
// 注入位（issue #66）：首个 turn 的**首个 step/start 之后**，即
//   turn/start → step/start → 声明 → 该轮真实提问
// 声明仍是模型可见顺序里的第一条消息（语义与「钉在首个 turn 之前」等价），但日志
// 里不再有任何 surface 事件早于第一个 step/start。宿主格式迁移（v2→v3）在第一个
// step/start 处插入 system head，而 emitSystem 要求已打开 step，迁移器对「首个
// step/start 之前的 surface 事件」fail-closed 拒绝（"format v2 surface before first
// step cannot acquire a system head without changing chronology"）——0.18.3 及以前
// 写出的日志正是这个形状，在需要迁移的旧格式 DSH 上打不开。首轮没有任何 step
//（只有提问、没有回复）时无 step/start 可锚，声明不注入（与无轮次时不注入一致）。
export function synthesizeSession({ meta, turns, title, provider, model, skipped, records, skippedLines = [], secrets = [], permissionCount = 0, systemPrompt }) {
  const events = []
  let seq = 0
  let turn = 0
  const push = (type, data, surface, sourceEventSeqs) => {
    const ev = { type, seq: seq++, time: meta.createdAt, data }
    if (surface) ev.surfaceOp = 'append'
    if (sourceEventSeqs) ev.sourceEventSeqs = sourceEventSeqs
    events.push(ev)
    return ev
  }

  const mname = model || provider

  // 会话级配对预扫描。DSH 的消息投影不重排（事件顺序即 wire 顺序），宿主 v3→v4
  // 迁移器对工具生命周期同样 fail-closed：调用必须在**被广告的同一 step 内**闭合
  //（step/end 时未闭合调用即拒载）、每个调用恰好一条结果、结果必须有广告。而源记录
  // 的异步结果可能晚于调用若干 step / 若干轮才到达，孤儿结果（转录中途开始）与重复
  // 结果也会出现，所以先按 callId 全程归位，再合成：
  //   - 真实结果统一发射在**调用的 step**（紧随其 tool/call）；跨 step/跨轮到达的
  //     异步结果提前到调用旁——调用所在 step 从此必然闭合，wire 顺序合法，配对语义
  //     不变（callId 关联保持，sourceEventSeqs 指向其 tool/call）；
  //   - 无广告调用的孤儿结果、同一调用的第 2+ 条结果：丢弃并计数（失败大声），
  //     计数经 attachConversionDetails / batchItem 上报，与 interchange 管线的
  //     orphan-tool-result 丢弃策略同口径。
  const callById = new Map()
  const resultByCallId = new Map()
  let duplicateToolResults = 0
  for (const t of turns) {
    for (const s of t.steps) {
      for (const tc of s.toolCalls) if (!callById.has(tc.id)) callById.set(tc.id, tc)
      for (const tr of s.toolResults) {
        if (resultByCallId.has(tr.toolCallId)) { duplicateToolResults++; continue }
        resultByCallId.set(tr.toolCallId, tr)
      }
    }
  }
  let orphanToolResults = 0
  for (const callId of [...resultByCallId.keys()]) {
    if (!callById.has(callId)) { orphanToolResults++; resultByCallId.delete(callId) }
  }

  // 导入归属只落 imports registry（sourcePath → dshId 反查即得），不写
  // 日志事件：dsh ≥ 0.1.2-alpha 的读取路径 fail-closed（KNOWN_SESSION_EVENT_TYPES
  // 白名单 + envelope 键白名单），宿主词汇表外的自产标记事件会让整份日志被拒载
  //（issue #34）。导入标记读取按 registry 优先、旧日志标记兜底。

  // 环境变更声明（总是注入）：作为「上下文注入」的 user/message 放在首个 turn 的
  // 首个 step/start 之后（注入位见函数头注释，issue #66）。source.kind='plugin' 让
  // UI 折叠显示为「上下文注入 · chat-import」；正文前置环境变更声明（模型看到的是
  // 迁移后的新环境，旧工具名/命令不再适用）。开关开启时各源把原始系统提示词收集进
  // systemPrompt，由 contextInjectionText 附在声明之后。只注入一次：惰性发射器在
  // 第一个 step/start 处消费后置位；首轮无 step 时无 step/start 可锚，不注入。
  // 系统提示词 head（宿主 v3→v4 迁移的硬不变量，issue：导入会话在 V4 宿主上打不开）：
  // surface 的第一个事件必须是 system/message，它是「protected head」——此后每一步宿主
  // 写自己的 system/message 都以它为替换锚点。宿主自己的会话在首个 step/start 处就写这
  // 一条（v2→v3 迁移器同样在第一个 step/start 处插一条空 head），导入会话此前不写，
  // surface 从 user/message 起，于是宿主续聊写 system/message 时被迁移器 fail-closed：
  //   "system/message requires a protected first surface head"
  //（导入会话本身、以及由它 seed 出来的续聊会话都会中招；原生会话因为有 head 不受影响。）
  // 内容留空（content: []）——与宿主自己合成的 head 同口径：head 只占住 surface 第 0 个
  // 节点，真正的系统提示词由宿主在下一步替换或归一化，导入不该虚构一份提示词。
  // 位置与宿主一致：第一个 step/start 之后、任何 surface 事件之前。
  let headPushed = false
  const pushSystemHead = (turn, step) => {
    headPushed = true
    push('system/message', {
      turn,
      step,
      message: {
        id: 'import:' + meta.id + ':sys',
        role: 'system',
        content: [],
        source: { kind: 'plugin', plugin: 'chat-import' },
      },
    }, true)
  }

  let envInjected = false
  const pushEnvInjection = () => {
    envInjected = true
    push('user/message', {
      id: 'import:' + meta.id + ':env',
      role: 'user',
      content: [{ type: 'text', text: contextInjectionText(provider, systemPrompt) }],
      source: { kind: 'plugin', plugin: 'chat-import' },
    }, true)
  }

  for (const t of turns) {
    turn += 1
    push('turn/start', { turn })
    if (t.steps.length === 0) {
      // 只有提问、没有回复的轮次。首个 turn 就没有 step 时 head 没有可锚的 step：为它补
      // 一个只装 head 的 step（空 step 合法——step/end 只对未闭合的工具调用 fail-closed）
      if (!headPushed) {
        push('step/start', { turn, step: 1 })
        pushSystemHead(turn, 1)
        push('step/end', { turn, step: 1 })
      }
      push('user/message', {
        id: 'import:' + meta.id + ':u' + turn,
        role: 'user',
        content: [{ type: 'text', text: t.prompt }],
        source: { kind: 'user' },
      }, true)
    } else {
      for (let i = 0; i < t.steps.length; i++) {
        const stepNum = i + 1
        const step = t.steps[i]
        push('step/start', { turn, step: stepNum })
        if (!headPushed) pushSystemHead(turn, stepNum)
        if (!envInjected) pushEnvInjection()
        if (i === 0) {
          push('user/message', {
            id: 'import:' + meta.id + ':u' + turn,
            role: 'user',
            content: [{ type: 'text', text: t.prompt }],
            source: { kind: 'user' },
          }, true)
        }
        push('assistant/message', {
          turn,
          step: stepNum,
          // 宿主 dsh >= 0.1.5 的 assertAssistantSettlementShape 要求 assistant/message
          // 除 turn/step 外还携带 stream 数组；导入会话没有 provider 流记录，空数组
          // 既是类型正确的 settlement，也不虚构不存在的流。
          stream: [],
          message: {
            id: 'import:' + meta.id + ':a' + turn + ':' + stepNum,
            role: 'assistant',
            content: step.content,
            // 源记录单条消息模型时（opencode）以 step.model 优先，否则回退会话级 model
            source: { kind: 'model', provider, model: step.model || mname },
          },
        }, true)
        const callSeqs = []
        for (const tc of step.toolCalls) {
          const ev = push('tool/call', {
            turn,
            step: stepNum,
            callId: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          })
          callSeqs.push(ev.seq)
        }
        // 配对不变量：每个 tool/call 在其广告的同一 step 内闭合——真实结果（预扫描
        // 已按调用归位）优先，全程无结果的调用（Cursor 无 tool_result、Claude/Codex/
        // Reasonix/Gemini 中断）补发空 result；content 用空数组：不虚构文本，wire
        // 适配器会把空内容归一为 "(no output)"（dsh-llm-deepseek / dsh-llm-pi-ai 的
        // serialize 均 `|| "(no output)"`）。不闭合则 resume 时模型 API 拒绝
        // （assistant 带 tool_calls 但缺 tool 消息），V4 迁移也在 step/end 拒载。
        for (let ci = 0; ci < step.toolCalls.length; ci++) {
          const tc = step.toolCalls[ci]
          const tr = resultByCallId.get(tc.id)
          push('tool/result', {
            turn,
            step: stepNum,
            message: {
              id: 'import:' + meta.id + ':t' + turn + ':' + stepNum + ':' + tc.id,
              role: 'user',
              content: [{
                type: 'tool-result',
                toolCallId: tc.id,
                content: tr ? tr.content : [],
                ...(tr && tr.isError ? { isError: true } : {}),
              }],
              source: { kind: 'tool', callId: tc.id },
            },
          }, true, [callSeqs[ci]])
        }
        push('step/end', { turn, step: stepNum })
      }
    }
    // 源记录标注该回合被中断时如实反映。Codex 的 turn_aborted.reason 恒为粗粒度
    // 'interrupted'，不区分用户 / hook / 销毁，故用宿主为「导入且原始粗粒度记录未携带
    // 原因」预留的 legacy 原因（TurnEndCancelCause 的注释正是这个场景）。
    push('turn/end', {
      turn,
      reason: t.aborted ? { kind: 'aborted', reason: { kind: 'legacy' } } : { kind: 'completed' },
    })
  }

  // 标题：ai-title → session/title 事件（钉住，避免自动回退标题覆盖）。
  const normalizedTitle = (title || '').trim()
  if (normalizedTitle.length > 0) {
    push('session/title', { title: normalizedTitle, messageSeqs: [], source: { kind: 'user' } })
  }

  return {
    meta,
    events,
    turns,
    title,
    // 「消息数」只统计真实 source 消息：上下文注入（环境变更声明 / 源系统提示词，
    // source.kind='plugin'）是折叠行，不计入——避免「已导入 Y 条消息」被 +1 虚增。
    messages: events.filter((e) =>
      (e.type === 'user/message' || e.type === 'assistant/message' || e.type === 'tool/result')
      && !(e.data && e.data.source && e.data.source.kind === 'plugin')).length,
    toolCalls: events.filter((e) => e.type === 'tool/call').length,
    skipped,
    records,
    // 上报透传：畸形行明细（封顶由 parseJsonlLines 保证）、疑似 secrets
    // 位置清单（只含 line+kind，绝不含内容）、permission 计数（Claude 源，0 不占键）
    skippedLines,
    secrets,
    ...(permissionCount > 0 ? { permissionCount } : {}),
    ...(orphanToolResults > 0 ? { orphanToolResults } : {}),
    ...(duplicateToolResults > 0 ? { duplicateToolResults } : {}),
  }
}


export function tailSessionEvents(converted, { fromTurn, fromSeq, dropSessionEvents = true }) {
  const keep = []
  const oldToNew = new Map()
  let currentTurn = null
  let droppedBoundaryResults = 0
  for (const ev of converted.events ?? []) {
    if (ev && ev.type === 'turn/start' && ev.data && typeof ev.data.turn === 'number') {
      currentTurn = ev.data.turn
    }
    if (ev && ev.type === 'session/title') {
      if (dropSessionEvents) continue
      oldToNew.set(ev.seq, fromSeq + keep.length)
      keep.push(ev)
      continue
    }
    if (isEnvInjectionEvent(ev)) continue
    if (currentTurn !== null && currentTurn >= fromTurn) {
      if (Array.isArray(ev.sourceEventSeqs)) {
        for (const s of ev.sourceEventSeqs) {
          // 引用不在已处理的尾内事件里 → 指向尾外（前段 seq 未变，原样保留合法）
          if (!oldToNew.has(s)) droppedBoundaryResults++
        }
      }
      oldToNew.set(ev.seq, fromSeq + keep.length)
      keep.push(ev)
    }
  }
  return {
    firstTurn: fromTurn,
    droppedBoundaryResults,
    events: keep.map((ev, i) => {
      const next = { ...ev, seq: fromSeq + i }
      if (Array.isArray(ev.sourceEventSeqs)) {
        next.sourceEventSeqs = ev.sourceEventSeqs.map((s) => (oldToNew.has(s) ? oldToNew.get(s) : s))
      }
      return next
    }),
  }
}

// ── 超长会话三层保护（纯函数，零 DSH 依赖）─────────────────────────
// 导入会话在无 provider 配置时不会被 dsh 自动压缩（routedTarget 解析失败），超长
// 会话全量落盘后恢复对话直接 400。保护分三层，预算（token 数）由 index 层解析
// （工具参数 > 环境变量 DSH_IMPORT_CONTEXT_BUDGET > 动态模型窗口 > 静态默认 550k）
// 后经 args.budget 传入：
//   L1 单条内容裁剪——单条文本 ≤16K 字符、工具结果 ≤40K 字符（保留头 75% + 尾）；
//   L2 消息预算截断——保留开头锚点（最早 3 轮，含其 assistant 消息与工具调用）+ 压缩摘要 + 尾部消息；
//   L3 单条兜底——裁剪后单条消息仍超预算一半 → 直接丢弃（宁缺毋滥）。

// 文本 → token 估算（折算系数约 2.0）：CJK 1 token/字、ASCII 1 token/4 字符。
// CJK 覆盖主平面/扩展 A/B/兼容、CJK 标点与全角形式；其余字符按 ASCII 折算。
export function estimateTokens(text) {
  if (typeof text !== 'string' || text.length === 0) return 0
  let cjk = 0
  let ascii = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if ((cp >= 0x3400 && cp <= 0x4dbf)
      || (cp >= 0x4e00 && cp <= 0x9fff)
      || (cp >= 0xf900 && cp <= 0xfaff)
      || (cp >= 0x3000 && cp <= 0x303f)
      || (cp >= 0xff00 && cp <= 0xffef)
      || (cp >= 0x20000 && cp <= 0x2a6df)) {
      cjk++
    } else {
      ascii++
    }
  }
  return cjk + Math.ceil(ascii / 4)
}

// 第一层裁剪上限：单条文本 / 单条工具结果的最大字符数。
export const TEXT_BLOCK_CHAR_LIMIT = 16000
export const TOOL_RESULT_CHAR_LIMIT = 40000
const CROP_MARKER = '\n…（已裁剪）…\n'

// 单条文本裁剪：超限时保留头 75% + 尾 25%（合计 ≤ 上限），中间以裁剪标记衔接。
function cropText(text, limit) {
  if (text.length <= limit) return { text, cropped: false }
  const room = Math.max(1, limit - CROP_MARKER.length)
  const head = Math.floor(room * 0.75)
  const tail = room - head
  return { text: text.slice(0, head) + CROP_MARKER + text.slice(-tail), cropped: true }
}

// 裁剪一组 content block：text/reasoning 按 textLimit、tool-result 内部块按
// toolResultLimit（工具结果通常单块，近似单条结果上限）。返回 { blocks, cropped }。
export function cropContentBlocks(blocks, { textLimit = TEXT_BLOCK_CHAR_LIMIT, toolResultLimit = TOOL_RESULT_CHAR_LIMIT } = {}) {
  if (!Array.isArray(blocks)) return { blocks: [], cropped: 0 }
  let cropped = 0
  const out = blocks.map((b) => {
    if (!b || typeof b !== 'object') return b
    if ((b.type === 'text' || b.type === 'reasoning') && typeof b.text === 'string') {
      const r = cropText(b.text, textLimit)
      if (!r.cropped) return b
      cropped++
      return { ...b, text: r.text }
    }
    if (b.type === 'tool-result' && Array.isArray(b.content)) {
      const inner = cropContentBlocks(b.content, { textLimit: toolResultLimit, toolResultLimit })
      if (inner.cropped === 0) return b
      cropped += inner.cropped
      return { ...b, content: inner.blocks }
    }
    return b
  })
  return { blocks: out, cropped }
}

// content block 数组 → token 估算（text/reasoning 按正文、tool-call 按 arguments、
// tool-result 递归内部块；与投影到模型的消息内容口径一致）。
function estimateBlocks(blocks) {
  let total = 0
  for (const b of blocks || []) {
    if (!b || typeof b !== 'object') continue
    if (b.type === 'text' || b.type === 'reasoning') total += estimateTokens(b.text)
    else if (b.type === 'tool-call') total += estimateTokens(b.arguments)
    else if (b.type === 'tool-result' && Array.isArray(b.content)) total += estimateBlocks(b.content)
  }
  return total
}

// turns IR → token 估算：prompt + 每步 content + 工具结果 content。
function estimateTurns(turns) {
  let total = 0
  for (const t of turns || []) {
    total += estimateTokens(t.prompt)
    for (const s of t.steps || []) {
      total += estimateBlocks(s.content)
      for (const tr of s.toolResults || []) total += estimateBlocks(tr.content)
    }
  }
  return total
}

// 三层保护总入口。返回 { turns, trimmed }：turns 为裁剪后的新结构（输入不改动），
// trimmed 为裁剪上报计数（budget / 前后估算 / L1 裁剪块数 / L2 丢弃轮与消息 /
// L3 超半丢弃 / 摘要标记）。预算内会话只走 L1（单条超限内容裁剪），不截断。
export function trimTurns(turns, budget, { anchorUserTexts = 3, summaryAllowance = 512 } = {}) {
  const src = turns || []
  const originalTokens = estimateTurns(src)
  const trimmed = {
    budget,
    originalTokens,
    estimatedTokens: 0,
    croppedBlocks: 0,
    droppedTurns: 0,
    droppedMessages: 0,
    droppedToolCalls: 0,
    droppedToolResults: 0,
    droppedOversized: 0,
    summaryInserted: false,
  }
  if (src.length === 0) {
    trimmed.estimatedTokens = 0
    return { turns: [], trimmed }
  }

  // L1：克隆 + 单条内容裁剪（text/reasoning ≤16K 字符、工具结果 ≤40K 字符）
  let croppedBlocks = 0
  const l1 = src.map((t) => ({
    // 保留 prompt/steps 之外的回合级字段（如 codex 的 aborted）：预算裁剪在生产路径上
    // 恒被调用（resolveImportBudget 恒返回数字），漏掉它会把「中断的回合」静默说成正常完成
    ...t,
    prompt: t.prompt,
    steps: (t.steps || []).map((s) => {
      const cc = cropContentBlocks(s.content)
      let stepCropped = cc.cropped
      let toolResults = s.toolResults || []
      if (toolResults.length > 0) {
        toolResults = toolResults.map((tr) => {
          const inner = cropContentBlocks(tr.content, { textLimit: TOOL_RESULT_CHAR_LIMIT, toolResultLimit: TOOL_RESULT_CHAR_LIMIT })
          stepCropped += inner.cropped
          if (inner.cropped === 0) return tr
          return { ...tr, content: inner.blocks }
        })
      }
      croppedBlocks += stepCropped
      return { ...s, content: cc.blocks, toolResults }
    }),
  }))
  trimmed.croppedBlocks = croppedBlocks

  const l1Estimate = estimateTurns(l1)
  if (l1Estimate <= budget) {
    trimmed.estimatedTokens = l1Estimate
    return { turns: l1, trimmed }
  }

  // L2：消息预算截断——保留开头锚点（最早 3 轮，含其 assistant 消息与工具调用）+ 压缩摘要 + 尾部消息。
  // 尾部从末尾往回贪心，在「锚点 + 摘要预留」的剩余预算内尽量多留；锚点本身超
  // 预算（病态小预算）时从尾部收缩锚点，保证至少留 1 轮可续聊。
  const anchorCount = Math.min(anchorUserTexts, l1.length)
  let anchor = l1.slice(0, anchorCount)
  const rest = l1.slice(anchorCount)
  let anchorTokens = estimateTurns(anchor)
  while (anchor.length > 1 && anchorTokens + summaryAllowance > budget) {
    anchor = anchor.slice(0, -1)
    anchorTokens = estimateTurns(anchor)
  }
  const tail = []
  let tailTokens = 0
  for (let i = rest.length - 1; i >= 0; i--) {
    const add = estimateTurns([rest[i]])
    if (anchorTokens + summaryAllowance + tailTokens + add > budget) break
    tail.unshift(rest[i])
    tailTokens += add
  }
  // 锚点收缩从锚点尾部丢掉的轮次（l1[anchor.length, anchorCount)）并入 middle：
  // rest 为空（整段 ≤ 锚点轮数）时这些轮曾直接消失且不计 dropped*，导致
  // applyBudgetTrim engaged 全零 → trimmed 静默为 null。并入后走同一计数循环，
  // droppedTurns / droppedMessages / droppedToolCalls / droppedToolResults 如实反映；
  // 收缩守卫 anchor.length > 1 仍保证至少留 1 轮可续聊。
  const middle = [...l1.slice(anchor.length, anchorCount), ...rest.slice(0, rest.length - tail.length)]

  for (const t of middle) {
    trimmed.droppedTurns++
    let resultCount = 0
    for (const s of t.steps) {
      trimmed.droppedToolCalls += s.toolCalls.length
      trimmed.droppedToolResults += s.toolResults.length
      resultCount += s.toolResults.length
    }
    trimmed.droppedMessages += 1 + t.steps.length + resultCount
  }

  // 压缩摘要：作为 reasoning 块前置到首个保留尾部轮的 assistant 步骤（opencode
  // compaction 同款模式），不新增空 user 轮次；尾部为空时挂到锚点末轮。
  const kept = [...anchor, ...tail]
  if (trimmed.droppedTurns > 0 && kept.length > 0) {
    const attach = tail.length > 0 ? tail[0] : anchor[anchor.length - 1]
    const summaryText = '…[导入预算裁剪] 原对话约 ' + originalTokens
      + ' tokens，超出上下文预算 ' + budget + ' tokens。为保持可续聊，已保留开头锚点'
      + '与最近对话，裁剪中间 ' + trimmed.droppedTurns + ' 轮（' + trimmed.droppedMessages
      + ' 条消息、' + trimmed.droppedToolCalls + ' 次工具调用）。完整历史见源文件。'
    if (attach.steps.length > 0) {
      attach.steps[0].content.unshift({ type: 'reasoning', text: summaryText })
    } else {
      attach.steps.push({ content: [{ type: 'reasoning', text: summaryText }], toolCalls: [], toolResults: [] })
    }
    trimmed.summaryInserted = true
  }

  // L3：单条兜底——裁剪后单条消息仍超预算一半 → 直接丢弃（宁缺毋滥）。首轮
  // prompt 永不丢弃（保证至少一条可续聊的用户消息）；超大的 step 连同其工具调用
  // 一起丢（配对保持完整），超大的工具结果丢后由 synthesizeSession 补空结果。
  const halfBudget = budget / 2
  const kept2 = []
  for (let i = 0; i < kept.length; i++) {
    const t = kept[i]
    if (i > 0 && estimateTokens(t.prompt) > halfBudget) {
      trimmed.droppedTurns++
      let resultCount = 0
      for (const s of t.steps) {
        trimmed.droppedToolCalls += s.toolCalls.length
        trimmed.droppedToolResults += s.toolResults.length
        resultCount += s.toolResults.length
      }
      trimmed.droppedMessages += 1 + t.steps.length + resultCount
      trimmed.droppedOversized++
      continue
    }
    const steps = []
    for (const s of t.steps) {
      if (estimateBlocks(s.content) > halfBudget) {
        trimmed.droppedMessages++
        trimmed.droppedToolCalls += s.toolCalls.length
        trimmed.droppedToolResults += s.toolResults.length
        trimmed.droppedOversized++
        continue
      }
      const toolResults = []
      for (const tr of s.toolResults) {
        if (estimateBlocks(tr.content) > halfBudget) {
          trimmed.droppedMessages++
          trimmed.droppedToolResults++
          trimmed.droppedOversized++
          continue
        }
        toolResults.push(tr)
      }
      steps.push({ ...s, toolResults })
    }
    kept2.push({ ...t, steps })
  }

  trimmed.estimatedTokens = estimateTurns(kept2)
  return { turns: kept2, trimmed }
}

// 统一裁剪入口（convertXxx 接线用）：budget 缺省/非正数 → 原样返回（trimmed=null，
// 不产生上报）；保护未实际生效（无任何裁剪/截断/丢弃）时同样返回 null，避免噪音。
export function applyBudgetTrim(turns, budget) {
  if (budget === undefined || budget === null) return { turns: turns || [], trimmed: null }
  const b = Number(budget)
  if (!Number.isFinite(b) || b <= 0) return { turns: turns || [], trimmed: null }
  const { turns: out, trimmed } = trimTurns(turns, b)
  const engaged = trimmed.croppedBlocks > 0 || trimmed.droppedTurns > 0 || trimmed.droppedMessages > 0
    || trimmed.droppedToolCalls > 0 || trimmed.droppedToolResults > 0 || trimmed.droppedOversized > 0
    || trimmed.summaryInserted
  return { turns: out, trimmed: engaged ? trimmed : null }
}

// ── 畸形行行号明细 + secrets 位置上报（共享纯函数）───────────────────
// 逐行 JSONL 转换器（claude/codex/cursor/reasonix/openclaw/grokbuild/hermes/kimi）
// 共用 parseJsonlLines：行号从 1 起；skipped 计数不设限，skippedLines 明细封顶
// SKIPPED_LINES_CAP（200）条；secrets 每行至多一条（首个命中 kind）。整文件转换器
// 无行概念，只回 skippedLines: []（如实，不虚构行号）。

// 畸形行明细封顶条数（计数 skipped 不设限）。
export const SKIPPED_LINES_CAP = 200

// 疑似 secrets 的保守正则清单（按优先级排列，首个命中即报告该 kind，去重）：
//   api-key：sk- 前缀（Anthropic/OpenAI）与 api_key / api-key 赋值；
//   token：ghp_ 前缀（GitHub PAT）与 token 赋值；
//   password / secret：对应关键字赋值；
//   authorization：Authorization 头（含 Bearer）。
// 只做「疑似」上报，不追求精确；键名与值都接受引号包裹（JSON 里 `"token": "x"`）。
const SECRET_PATTERNS = [
  { kind: 'api-key', re: /\bsk-[A-Za-z0-9_-]{8,}\b/ },
  { kind: 'token', re: /\bghp_[A-Za-z0-9]{20,}\b/ },
  { kind: 'api-key', re: /\bapi[_-]?key\s*["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}\b/i },
  { kind: 'token', re: /\btoken\s*["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}\b/i },
  { kind: 'password', re: /\bpassword\s*["']?\s*[:=]\s*["']?[^\s"']{4,}\b/i },
  { kind: 'secret', re: /\bsecret\s*["']?\s*[:=]\s*["']?[^\s"']{4,}\b/i },
  { kind: 'authorization', re: /\bauthorization\s*["']?\s*[:=]\s*["']?(?:bearer\s+)?[A-Za-z0-9._~+/=-]{10,}\b/i },
]

// 命中 kind 数组（按正则优先级去重）；无命中返回空数组。
export function detectSecretKinds(line) {
  const kinds = []
  for (const { kind, re } of SECRET_PATTERNS) {
    if (!re.test(String(line))) continue
    if (!kinds.includes(kind)) kinds.push(kind)
  }
  return kinds
}

// JSON.parse 错误消息可能内嵌行首内容片段（V8 拼 `', "…" is not valid JSON`，片段内
// 可含嵌套引号/截断省略号，且可能含 secret）——把 `', "…" 到 ` is not valid JSON`
// 的整段内容剥离后截断，绝不携带行内容；无片段的消息（纯位置描述）原样保留。
function sanitizeParseError(err) {
  const msg = String((err && err.message) || err)
    .replace(/', "[\s\S]* is not valid JSON/, "', \"…\" is not valid JSON")
  return msg.length <= 160 ? msg : msg.slice(0, 160) + '…'
}

// 逐行 JSONL 解析。返回 { recs, skipped, skippedLines, secrets }：
//   recs        成功解析的记录；requireObject=true 时只含对象（其余计入 skipped）；
//   skipped     畸形行计数（不设限）；
//   skippedLines 行号明细 [{ line, error }]，封顶 SKIPPED_LINES_CAP 条；
//   secrets     疑似 secret 位置 [{ line, kind }]，每行至多一条。
// 空白行忽略（不计 skipped）。
export function parseJsonlLines(raw, { requireObject = false } = {}) {
  const recs = []
  let skipped = 0
  const skippedLines = []
  const secrets = []
  const lines = String(raw ?? '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!t) continue
    const kinds = detectSecretKinds(t)
    if (kinds.length > 0) secrets.push({ line: i + 1, kind: kinds[0] })
    let rec
    try {
      rec = JSON.parse(t)
    } catch (err) {
      skipped++
      if (skippedLines.length < SKIPPED_LINES_CAP) {
        skippedLines.push({ line: i + 1, error: sanitizeParseError(err) })
      }
      continue
    }
    if (requireObject && (!rec || typeof rec !== 'object')) {
      skipped++
      if (skippedLines.length < SKIPPED_LINES_CAP) {
        skippedLines.push({ line: i + 1, error: 'non-object record' })
      }
      continue
    }
    recs.push(rec)
  }
  return { recs, skipped, skippedLines, secrets }
}

// 校验器拆到 validate.mjs（本文件已超 convert 层体量停止线）；这里原样 re-export，
// 既有的 from './core.mjs' 引用与 lib/convert/index.mjs 的再导出都不受影响。
export { SESSION_EVENT_TYPES, VALIDATION_PROBLEM_CAP, validateSessionEvents } from './validate.mjs'

// 形状契约拆到 shape.mjs（体量停止线）；内部沿用 + 原样 re-export，既有 from './core.mjs'
// 引用（~20 个转换器模块与 lib/convert/index.mjs）不受影响。
import { isEnvInjectionEvent } from './shape.mjs'
export { ENV_INJECTION_EVENT_ID_SUFFIX, isEnvInjectionEvent, toolResultOf, shapeToolResults } from './shape.mjs'
