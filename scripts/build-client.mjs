// scripts/build-client.mjs — 由 src/client/ 片段组装 lib/client.js（浏览器侧单文件 bundle）
//
// 为什么需要它：DSH 的客户端模块加载器没有相对 require、也没有资源 URL，插件的
// 浏览器侧产物必须是单个自包含文件（见 docs/architecture.md D7）。源码按职责
// 分片维护在 src/client/，本脚本逐字拼回 lib/client.js。
//
// 片段契约（违反即构建失败）：
//   - 片段共享 bundle 的 factory 作用域：禁止 import/export，跨片引用直接用人家的
//     顶层声明（顺序 = FRAGMENTS 数组顺序）；
//   - 保持 4 空格基准缩进（嵌在 factory 内的一层）；
//   - 行尾一律 LF（读入时 CRLF 归一）。
//
// 用法：
//   node scripts/build-client.mjs          # 组装并写 lib/client.js
//   node scripts/build-client.mjs --check  # 只校验产物新鲜度（npm run build 用）
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(root, 'src/client')
const OUT = resolve(root, 'lib/client.js')

/** 组装顺序即运行时声明顺序：跨片引用只能指向排在前面的片段。 */
const FRAGMENTS = [
  'i18n.js',      // 字典 DICT + fill + locale 服务句柄 + 工作区筛选助手
  'prefs.js',     // 侧栏按钮偏好存取 + useTranslate
  'sources.js',   // 来源枚举 / 标签 / 徽标 / 分页常量 / 排序
  'widgets.js',   // Icon / SourceBadge / useContainerWidth
  'styles.js',    // themeColors + makeStyles（DSW 设计令牌）
  'utils.js',     // fmt* / 结果摘要 / 响应解析 worker / Toggle
  'settings.js',  // 设置页「会话导入」分区 + 同步设置
  'tabs.js',      // ImportTabContent / SidebarImportTab / HistoryPanel / SearchableSelect
  'discovery.js', // DiscoveryPanel（发现 + 多选导入主面板）
  'footer.js',    // LogoIcon / 设置导航图标 / footer 车道量法
  'entry.js',     // ImportButton + apply()（槽注册、tab 类型注册）
]

const HEADER = `/* global window, document, fetch, getComputedStyle, MutationObserver, ResizeObserver, setTimeout, Worker, Blob */
 // lib/client.js — DSH Web 侧面板 bundle：右侧栏「导入会话」tab，支持发现、搜索、分页、多选导入。
 // 纯前端，只消费注入的 slots / locale / react，不 import DSH host 模块。
 //
 // GENERATED FILE — 勿手改。源在 src/client/ 分片，node scripts/build-client.mjs 组装。
window.__ModuleLoader__.load({
  id: "dsh-chat-import",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { useState, useEffect, useLayoutEffect, useRef } = React;
`

const FOOTER = `    module.exports = { name, inject, apply };
    return module.exports;
  },
})
`

/** 读一个片段并执行片段契约检查（禁 import/export、4 空格基准缩进）。 */
function fragment(name) {
  const text = readFileSync(resolve(SRC, name), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '')
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^[ \t]*(import|export)[ \t]/m.test(line)) {
      throw new Error(`build-client: src/client/${name} 第 ${i + 1} 行用了 import/export（片段共享 factory 作用域，禁止模块语法）`)
    }
    if (line.trim() !== '' && !/^ {4}/.test(line)) {
      throw new Error(`build-client: src/client/${name} 第 ${i + 1} 行不是 4 空格基准缩进：${line.trim().slice(0, 60)}`)
    }
  }
  return text
}

function assemble() {
  return [HEADER.replace(/\n+$/, ''), ...FRAGMENTS.map(fragment), FOOTER.replace(/\n+$/, '')].join('\n\n') + '\n'
}

const bundle = assemble()

// 语法门禁：bundle 必须能整体 parse 才允许落盘 / 通过校验。
try {
  new vm.Script(bundle, { filename: 'lib/client.js' })
} catch (error) {
  console.error('build-client: 组装产物语法校验失败：' + error.message)
  process.exit(1)
}

if (process.argv.includes('--check')) {
  const onDisk = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n')
  if (onDisk !== bundle) {
    console.error('build-client: lib/client.js 与 src/client/ 不同步——请运行 node scripts/build-client.mjs 重新组装')
    process.exit(1)
  }
  console.log(`build-client: OK — lib/client.js 与 src/client/（${FRAGMENTS.length} 片）同步`)
} else {
  writeFileSync(OUT, bundle)
  console.log(`build-client: built lib/client.js（${bundle.split('\n').length - 1} 行，${bundle.length} 字节，${FRAGMENTS.length} 片）`)
}
