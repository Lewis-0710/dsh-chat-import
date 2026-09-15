// .github/scripts/check-doc-links.mjs — 文档相对链接护栏（CI + 本地）
//
// 背景：`docs/USAGE*.md` 里把同目录文件写成 `docs/INTERCHANGE.md`，而这两个文件本身就在
// `docs/` 下 —— 相对链接解析成 `docs/docs/INTERCHANGE.md`，GitHub 上 404、本地也打不开，
// 而单元测试 / lint / 双语标题同步护栏都看不见这类失效（issue #56）。
//
// 规则：受版本管理的 `*.md` 里所有相对链接（含图片）必须解析到存在的路径。
//   - 跳过外链（http/https/mailto）、页内锚点（#…）、尖括号包裹的目标；
//   - 跳过 ``` 围栏代码块内的内容（示例代码里的 `[..](..)` 不是链接）；
//   - 目标带锚点/查询串时只校验路径部分。
//
// 用法：node .github/scripts/check-doc-links.mjs（无参数，扫描 `git ls-files "*.md"`）。

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const files = execSync('git ls-files "*.md"', { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean)
const problems = []
let checked = 0

// 逐行剥掉 ``` / ~~~ 围栏内的内容（保留行号，便于报 file:line）
function stripFenced(text) {
  const out = []
  let fence = null
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*(```+|~~~+)/.exec(line)
    if (m) {
      fence = fence === null ? m[1][0] : null
      out.push('')
      continue
    }
    out.push(fence === null ? line : '')
  }
  return out
}

for (const file of files) {
  if (!existsSync(file)) continue
  const lines = stripFenced(readFileSync(file, 'utf8'))
  for (let i = 0; i < lines.length; i += 1) {
    for (const m of lines[i].matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = m[1].trim()
      if (/^(https?:|mailto:|#|<)/i.test(target)) continue
      const clean = target.split('#')[0].split('?')[0]
      if (!clean) continue
      checked += 1
      // 相对链接按所在文件的目录解析（绝对路径 / 盘符路径直接判存在性）
      if (!existsSync(resolve(dirname(resolve(file)), clean))) {
        problems.push(`${file}:${i + 1} 相对链接指向不存在的路径：${target}`)
      }
    }
  }
}

if (problems.length > 0) {
  console.error('check-doc-links: FAIL — 文档链接失效（GitHub 与本地都打不开）：')
  for (const p of problems) console.error('  - ' + p)
  console.error('在同目录文件请写相对目标（如 docs/USAGE.md 里写 INTERCHANGE.md），显示文字可保留仓库内路径。')
  process.exit(1)
}
console.log(`check-doc-links: OK — ${files.length} 个 .md、${checked} 条相对链接全部有效`)
