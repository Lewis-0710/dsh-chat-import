// lib/sources/dsh.mjs — DSH 自身会话日志的读取与目录收集适配。DSH 落盘是 zstd 压缩
// JSONL，fs.readText 不解压，因此这里优先用 node:zlib 原生 zstd（异步、libuv 线程池，
// 不占主进程事件循环）；Node < 22.15 没有 zstdDecompress 时回退 fzstd（纯 JS 同步）。
// 两条路径都不依赖系统 zstd 二进制，也避免 child_process 触发安全扫描的 code-exec 判定。
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import zlib from 'node:zlib'
import { decompress } from 'fzstd'

const HAS_NATIVE_ZSTD = typeof zlib.zstdDecompress === 'function'

// 会话工件按代次命名：v0 是 `session.jsonl`，vN（N>=1）是 `session.vN.jsonl`，
// 压缩再加 `.zstd` 后缀。这与宿主 sessionFormatLogFilename() 的口径一致。
// 只认 v0 会漏掉当前代次——本机 52 个会话里有 48 个是 v3，全部扫不出来。
const DSH_SESSION_LOG = /^session(?:\.v([1-9][0-9]*))?\.jsonl(?:\.zstd)?$/i

/**
 * 读出一个 DSH 会话日志文件名对应的格式代次。
 * @param name - 目录项名称，可含压缩后缀。
 * @returns 代次（v0 为 0），或 undefined 表示不是会话日志。
 */
export function dshSessionLogVersion(name) {
  const m = DSH_SESSION_LOG.exec(String(name || ''))
  return m ? Number(m[1] ?? 0) : undefined
}

export function isDshSessionFile(name) {
  return dshSessionLogVersion(name) !== undefined
}

// zstd 会话正文 → UTF-8 文本。优先原生异步解码（libuv 线程池，主进程事件循环零阻塞）；
// Node < 22.15 回退 fzstd 同步解码（事件循环会被顶住，仅旧版路径；能力探测一次）。
// preferNative 是给测试注入回退路径的开关（生产调用一律走默认值）。
export async function decodeZstdText(buf, { preferNative = HAS_NATIVE_ZSTD } = {}) {
  if (preferNative) {
    return await new Promise((resolve, reject) => {
      zlib.zstdDecompress(buf, (err, out) => {
        if (err) reject(err)
        else resolve(Buffer.from(out).toString('utf8'))
      })
    })
  }
  return Buffer.from(decompress(buf)).toString('utf8')
}

export function dshPath(target) {
  return target.displayPath || target.path || target
}

export async function readDshText(ctx, target) {
  const path = dshPath(target)
  if (/\.zstd$/i.test(path)) {
    return decodeZstdText(readFileSync(path))
  }
  return ctx.fs.readText(target)
}

// 递归收集目录下的 session.jsonl(.zstd)；跳过 events/conflicts/guardian 等伴生文件。
export async function collectDshFiles(ctx, dirTarget, out, recursive) {
  const entries = await ctx.fs.listDir(dirTarget)
  for (const entry of entries) {
    if (entry.type === 'directory') {
      if (recursive) await collectDshFiles(ctx, entry.target, out, recursive)
    } else if (entry.type === 'file' && isDshSessionFile(entry.name)) {
      out.push(entry.target)
    }
  }
}
