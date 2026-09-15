// lib/cline.mjs — Cline 会话索引（SQLite sessions.db + manifest）读取（host 面，非纯函数）
//
// 分工（cline/cline main @ 6e8bea1 实测）：
//   <dataDir>/db/sessions.db  表 sessions —— **只有元数据索引，不存消息**；消息一律在
//                             <sessionsDir>/<id>/<id>.messages.json，DB 用 messages_path
//                             指向它。
//   <sessionsDir>/<id>/<id>.json  session manifest —— 标题/模型/cwd 的**权威来源**
//                             （上游 listSessions 用 manifest 的 metadata.title 覆盖 DB 行）。
//
// 因此本模块读 DB 拿「有哪些会话 + cwd/时间/messages_path」，标题优先取 DB 的
// metadata_json.title、为空时回退 manifest（少读一个文件是常态路径）。
// sessions 表列（sqlite-db.ts 建表 + LEGACY_MIGRATIONS 逐列 ALTER）：
//   session_id(PK), source, pid, started_at, ended_at, exit_code, status, status_lock,
//   interactive, provider, model, cwd, workspace_root, team_name, enable_tools,
//   enable_spawn, enable_teams, parent_session_id, parent_agent_id, agent_id,
//   conversation_id, is_subagent, prompt, metadata_json, transcript_path, hook_path,
//   messages_path, updated_at
// **没有 title 列、没有 message_count 列**（标题在 metadata_json.title；创建时间是
// started_at）→ 消息数与「是否子代理」以外的展示项都靠这两点推导。
// 老库靠 ALTER TABLE 逐列升级，故列可能缺失 → 全部按存在性自适应读取（对齐
// lib/hermes.mjs 的 hasContent/PRAGMA 做法），缺列只丢该字段、不抛错。

import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { clineMessagesPath, readClineManifest } from './convert/cline.mjs'

// ISO/数字时间文本 → 毫秒；缺失或不可解析返回 null（不虚构「现在」，与
// lib/convert/cline.mjs 的 clineTime 同口径）。
function timeOf(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v < 1e11 ? Math.trunc(v) * 1000 : v
  if (typeof v === 'string' && v) {
    const n = Date.parse(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

// 表列清单：PRAGMA 对不存在的表返回空集（不抛），损坏库的异常由调用方统一兜底
function columnsOf(db, table) {
  return new Set(db.prepare('PRAGMA table_info(' + table + ')').all().map((c) => c.name))
}

// metadata_json → title（唯一被上游 sanitize 的稳定键：title ≤ 120 字符）
function metadataTitle(raw) {
  if (typeof raw !== 'string' || !raw) return ''
  try {
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' && typeof obj.title === 'string' ? obj.title : ''
  } catch {
    // 畸形 metadata_json 只丢标题，不影响其余列
    return ''
  }
}

// manifest（<id>.json）与转写（<id>.messages.json）的读取口径在 lib/convert/cline.mjs
// （纯函数，发现层复用同一份）；本模块只负责 SQLite 索引与导入参数派生。
export { clineMessagesPath, readClineManifest }

// 绝对路径形态判定（跨平台，不依赖 node:path.isAbsolute 的宿主语义）：Unix 根 /、
// Windows 盘符 X:\ 或 UNC \\server\share。DB 里的 messages_path 若为相对路径，
// 基准不在契约里（可能相对 dataDir）→ 一律按规范路径回退，避免拼出错的路径。
function isAbsoluteLike(p) {
  return /^([a-zA-Z]:[\\/]|[\\/])/.test(String(p))
}

/** Cline sessions.db → 会话摘要数组（非子代理会话）。读不到/非 Cline 库 → null。 */
export function readClineDb(dbPath) {
  let db
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
  } catch {
    return null
  }
  try {
    const cols = columnsOf(db, 'sessions')
    if (!cols.has('session_id')) return null
    const pick = (row, name) => (cols.has(name) ? row[name] : undefined)
    const sessionsDir = join(dirname(dirname(dbPath)), 'sessions')
    const out = []
    for (const row of db.prepare('SELECT * FROM sessions ORDER BY rowid DESC').all()) {
      const id = typeof row.session_id === 'string' && row.session_id ? row.session_id : null
      if (!id) continue
      // 子代理 / 团队任务会话：消息写在主会话目录内，不单独成会话
      const isSubagent = pick(row, 'is_subagent') === 1
        || Boolean(pick(row, 'agent_id'))
        || Boolean(pick(row, 'parent_session_id'))
      if (isSubagent) continue
      const rawPath = pick(row, 'messages_path')
      out.push({
        id,
        title: metadataTitle(pick(row, 'metadata_json')),
        prompt: typeof pick(row, 'prompt') === 'string' ? pick(row, 'prompt') : '',
        cwd: (typeof pick(row, 'cwd') === 'string' && pick(row, 'cwd'))
          || (typeof pick(row, 'workspace_root') === 'string' && pick(row, 'workspace_root') ? pick(row, 'workspace_root') : null),
        createdAt: timeOf(pick(row, 'started_at')),
        lastActiveAt: timeOf(pick(row, 'updated_at')) ?? timeOf(pick(row, 'ended_at')),
        model: typeof pick(row, 'model') === 'string' ? pick(row, 'model') : null,
        // messages_path 仅在**绝对路径**时直接用；相对路径的基准不在契约里 →
        // 按 <sessionsDir>/<id>/<id>.messages.json 规范路径解析（发现层会 stat 校验）
        messagesPath: typeof rawPath === 'string' && rawPath && isAbsoluteLike(rawPath)
          ? rawPath
          : clineMessagesPath(sessionsDir, id),
      })
    }
    return out
  } catch {
    // 表结构不符 / 库损坏 / 锁定：按「无此库」处理，发现层回退扫目录
    return null
  } finally {
    db.close()
  }
}

// 递归收集目录下的 <sessionId>.messages.json（Skip manifest / compaction / 其它 JSON）：
// 目录批量导入只认转写文件，子代理/团队消息文件由转换器按 agent 字段各自处置。
export async function collectClineFiles(ctx, dirTarget, out, recursive) {
  const entries = await ctx.fs.listDir(dirTarget)
  for (const entry of entries) {
    if (entry.type === 'directory') {
      if (recursive) await collectClineFiles(ctx, entry.target, out, recursive)
    } else if (entry.type === 'file' && /\.messages\.json$/i.test(entry.name)) {
      out.push(entry.target)
    }
  }
}

// 单文件导入参数派生：会话 id（文件名 stem，回退目录名）+ 元数据。
// 元数据分工（上游实测）：cwd/started_at/标题在 SQLite 索引里，manifest 的
// metadata.title 是权威标题，messages.json 里没有 cwd/title → DB 优先、manifest 补齐。
export async function clineDeriveArgs(ctx, target) {
  const p = target.displayPath || ctx.fs.processPath(target)
  const base = String(p).split(/[\\/]/).pop() || ''
  const stem = base.replace(/\.messages\.json$/i, '').replace(/\.json$/i, '')
  const dir = String(p).replace(/[\\/][^\\/]*$/, '')
  const dirName = String(dir).split(/[\\/]/).pop() || ''
  const id = stem || dirName
  const derived = { clineId: id }
  // DB 优先：<dir>/../../db/sessions.db（dir = <sessionsDir>/<id>）。readClineDb 自身
  // 把「缺失/锁定/非 Cline 库」归一为 null，故这里不需要再包一层异常兜底。
  const rows = readClineDb(join(dir, '..', '..', 'db', 'sessions.db'))
  const row = rows ? rows.find((s) => s.id === id) : null
  if (row) {
    if (row.cwd) derived.cwd = row.cwd
    if (typeof row.createdAt === 'number') derived.createdAt = row.createdAt
    if (typeof row.title === 'string' && row.title.trim()) derived.title = row.title
  }
  if (!derived.title || !derived.cwd || derived.createdAt === undefined) {
    let man = null
    try {
      man = readClineManifest(await ctx.fs.readText(await ctx.fs.resolve(join(dir, id + '.json'))))
    } catch {
      // manifest 缺失/不可读：保持 DB 值（可能为空），标题由转换器按首问兜底
    }
    if (man) {
      if (!derived.title && man.title.trim()) derived.title = man.title.trim()
      if (!derived.cwd && man.cwd) derived.cwd = man.cwd
      if (derived.createdAt === undefined && man.startedAt) {
        const t = Date.parse(man.startedAt)
        if (Number.isFinite(t)) derived.createdAt = t
      }
    }
  }
  return derived
}
