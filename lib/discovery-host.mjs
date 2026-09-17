// lib/discovery-host.mjs — REQ-25/REQ-40 会话发现（scan_discover 只读工具）host 适配
//
// 发现核心在 lib/discovery.mjs（纯函数，host 注入）。这里把 ctx.fs 与 SQLite 读取器
// 适配成 host：stat/readHead/readText/readDir + readSessions（复用 readOpencodeDb /
// readZcodeDb / readHermesDb，不重写 SQL）。readHead 优先走 streamText 有界读头
//（大 transcript 不整读）；无 streamText（如测试 mock）回退 readText 截断。
// REQ-41 面板路由（lib/panel.mjs）与 scan_discover 共用 makeDiscoveryHost。

import { join } from 'node:path'
import { discoverSessions } from './discovery.mjs'
import { readOpencodeDb } from './opencode.mjs'
import { readMimocodeDb } from './mimocode.mjs'
import { readKilocodeDb } from './kilocode.mjs'
import { readTeleagentDb } from './teleagent.mjs'
import { readZcodeDb } from './zcode.mjs'
import { readHermesDb } from './hermes.mjs'
import { readClineDb } from './cline.mjs'
import { readGooseSessions } from './goose.mjs'
import { readZedThreads } from './zed.mjs'
import { readCrushSessions } from './crush.mjs'
import { loadImports, archivedSessionIds } from './imports.mjs'
import { resolveCursorSlugPath, knownWorkspacePaths } from './cwd-map.mjs'

// SQLite 会话摘要（发现用）：每会话 id/title/directory/createdAt/lastActiveAt/
// messageCount。读不到（缺失/锁定/非 SQLite）返回 null，发现层按该格式无会话处理。
function dbSessionSummaries(kind, dbPath) {
  try {
    if (kind === 'opencode') {
      return readOpencodeDb(dbPath).map((s) => dbSummary(s, 'createdAt'))
    }
    // mimocode 是 opencode fork（schema 同构），readMimocodeDb 复用通用读取器并
    // 剔除 MiMo 后台任务会话（checkpoint-writer / AutoDream / AutoDistill）
    if (kind === 'mimocode') {
      return readMimocodeDb(dbPath).map((s) => dbSummary(s, 'createdAt'))
    }
    // kilocode 是 opencode fork（schema 同构），readKilocodeDb 复用通用读取器并
    // 跳过子/归档会话（parent_id / time_archived 非空）
    if (kind === 'kilocode') {
      return readKilocodeDb(dbPath).map((s) => dbSummary(s, 'createdAt'))
    }
    // teleagent 是 opencode 派生（schema 同构，issue #60），readTeleagentDb 复用通用
    // 读取器，全量导入（样本中未见后台任务会话）
    if (kind === 'teleagent') {
      return readTeleagentDb(dbPath).map((s) => dbSummary(s, 'createdAt'))
    }
    if (kind === 'zcode') {
      return readZcodeDb(dbPath).map((s) => dbSummary(s, 'createdAt'))
    }
    if (kind === 'hermes') {
      const rows = readHermesDb(dbPath)
      return rows === null ? null : rows.map((s) => ({
        id: s.id, title: s.title, directory: s.cwd,
        createdAt: s.createdAt, lastActiveAt: lastMsgTime(s.messages, 'ts'),
        messageCount: s.messages.length,
      }))
    }
    // cline：sessions.db 只有元数据（无 title/message_count 列）→ 直接透传摘要，
    // 发现层再按需补 manifest 标题并 stat 校验转写是否存在
    if (kind === 'cline') {
      const rows = readClineDb(dbPath)
      return rows === null ? null : rows.map((s) => ({
        id: s.id, title: s.title, prompt: s.prompt, directory: s.cwd,
        cwd: s.cwd, createdAt: s.createdAt, lastActiveAt: s.lastActiveAt,
        messageCount: null, messagesPath: s.messagesPath,
      }))
    }
    // goose：sessions.db 也是元数据 + 消息同库；发现只需摘要（sessionIds 过滤与
    // 逐会话导入在 lib/goose.mjs，用 readGooseDb 读全量）
    if (kind === 'goose') {
      const rows = readGooseSessions(dbPath)
      return rows === null ? null : rows.map((s) => ({
        id: s.id, title: s.title, directory: s.cwd,
        createdAt: s.createdAt ?? undefined, lastActiveAt: s.updatedAt ?? undefined,
        messageCount: s.messageCount,
      }))
    }
    // zed：threads 单表（标题在 summary 列）；时间只有行级 created_at/updated_at（RFC3339），
    // 消息数需要解压每个 zstd blob 才有 → 发现层留空（保持廉价路径）
    if (kind === 'zed') {
      const rows = readZedThreads(dbPath)
      return rows === null ? null : rows.map((s) => ({
        id: s.id, title: s.title, directory: s.cwd,
        createdAt: s.createdAt ? (Date.parse(s.createdAt) || undefined) : undefined,
        lastActiveAt: s.updatedAt ? (Date.parse(s.updatedAt) || undefined) : undefined,
        messageCount: s.messageCount,
      }))
    }
    // crush：sessions 表有 message_count 与秒级时间戳；**没有 cwd 列** → directory 留空，
    // 项目路径由扫描器按注册表/库位置补（见 discovery 的 scanCrush）
    if (kind === 'crush') {
      const rows = readCrushSessions(dbPath)
      return rows === null ? null : rows.map((s) => ({
        id: s.id, title: s.title, directory: null,
        createdAt: s.createdAt ?? undefined, lastActiveAt: s.updatedAt ?? undefined,
        messageCount: s.messageCount,
      }))
    }
  } catch {
    // 读不到 / 锁定 / 非 SQLite：按无该格式会话处理（发现是预览，不抛）
  }
  return null
}

function dbSummary(s, timeKey) {
  return {
    id: s.id, title: s.title, directory: s.directory,
    createdAt: s.createdAt, lastActiveAt: lastMsgTime(s.messages, timeKey),
    messageCount: s.messages.length,
  }
}

// 最后一条消息时间（最近活跃近似）；无消息/无时间 → undefined。
function lastMsgTime(messages, key) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const v = messages[i] && messages[i][key]
    if (typeof v === 'number') return v
  }
  return undefined
}

export function makeDiscoveryHost(ctx) {
  const fs = ctx.fs
  const resolve = (p) => fs.resolve(p)
  return {
    async stat(path) {
      try {
        const info = await fs.stat(await resolve(path))
        return info ? { type: info.type, size: info.size, mtimeMs: info.mtimeMs } : null
      } catch {
        // 缺失 / 无权限：按不存在处理，发现层跳过该路径
        return null
      }
    },
    async readHead(path, maxBytes) {
      try {
        const target = await resolve(path)
        if (typeof fs.streamText === 'function') {
          // 有界读头：取到 maxBytes 即停（for-await break 自动 close 迭代器）
          const iter = await fs.streamText(target)
          let out = ''
          for await (const chunk of iter) {
            out += chunk
            if (out.length >= maxBytes) break
          }
          return out.slice(0, maxBytes)
        }
        const text = await fs.readText(target)
        return text.slice(0, maxBytes)
      } catch {
        return null
      }
    },
    async readTail(path, maxBytes) {
      try {
        const target = await resolve(path)
        if (typeof fs.streamText === 'function') {
          // 无 seek API：流式读到底，滚动只保留末尾 maxBytes（大 transcript 也不整读入内存）
          const iter = await fs.streamText(target)
          let tail = ''
          for await (const chunk of iter) {
            tail = (tail + chunk).slice(-maxBytes)
          }
          return tail
        }
        const text = await fs.readText(target)
        return text.length > maxBytes ? text.slice(-maxBytes) : text
      } catch {
        return null
      }
    },
    async readText(path) {
      try {
        return await fs.readText(await resolve(path))
      } catch {
        // 缺失/非文本：null，发现层跳过该文件
        return null
      }
    },
    async readDir(path) {
      try {
        const entries = await fs.listDir(await resolve(path))
        return entries.map((e) => ({
          name: e.name,
          type: e.type,
          path: (e.target && (e.target.displayPath || e.target.targetKey)) || join(path, e.name),
        }))
      } catch {
        return null
      }
    },
    async readSessions(kind, dbPath) {
      return dbSessionSummaries(kind, dbPath)
    },
    resolveCursorSlug(slug) {
      return resolveCursorSlugPath(ctx, slug)
    },
    // 宿主侧「用户有哪些工作区」：项目内数据源（Crush 的 <项目>/.crush/crush.db）的发现入口。
    // 读不到就返回空数组（扫描器退化为只认显式 path / 用户级注册表）。
    async listWorkspaces() {
      try {
        return [...await knownWorkspacePaths(ctx)]
      } catch {
        return []
      }
    },
  }
}

// scan_discover 执行：registry 只读 loadImports（importStatus 标注）+ workspaceRegistry
// 全局归档集（已归档会话标注 'archived'，供重导预览），发现层零副作用（不写库、不
// create/append、不 touch 任何会话）。30s TTL 缓存由 discovery 模块持有；REQ-40 持久化
// mtime/size 书签落 $DSH_HOME/dsh-chat-import/scan-cache.json（与 imports registry
// 同目录），跨进程未变文件免重扫（写盘原子写，失败不影响扫描结果）。
export async function runScanDiscover(ctx, args, registryDir) {
  const registry = await loadImports(registryDir)
  return discoverSessions({
    path: args.path,
    format: args.format,
    query: args.query,
    host: makeDiscoveryHost(ctx),
    imports: registry.imports,
    cacheDir: registryDir,
    archivedIds: archivedSessionIds(ctx),
  })
}
