// panel-layout.test.mjs — 导入面板骨架（lib/client.js 内联 JSX 源码）的结构契约：
// 面板按「选择区 → 搜索 → 工具栏 → 列表 → 分页 → 底部主操作区」自上而下排布，
// 且来源/导入到/工作区三行同属一组、行间不画分隔线。
//
// 为什么读源码断言：面板是 client.js 里的 React.createElement 内联树，零构建、
// 无 DOM 测试环境（devDependencies 只有 eslint）。这些约定在真实 UI 上肉眼可见、
// 但没有任何模块边界能兜住——顺序或分隔线一旦被改回去，只有这里会响。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

/** DiscoveryPanel 的 body 表达式：从函数内 `const body = React.createElement` 到收尾 `return`。 */
function panelBody() {
  const start = source.indexOf('function DiscoveryPanel()')
  assert.notEqual(start, -1, 'lib/client.js 缺少 DiscoveryPanel')
  const bodyAt = source.indexOf('const body = React.createElement', start)
  assert.notEqual(bodyAt, -1, 'DiscoveryPanel 缺少 body 树')
  const end = source.indexOf('\n      return React.createElement("div", { ref: rootRef', bodyAt)
  assert.notEqual(end, -1, 'DiscoveryPanel body 树没有可识别的收尾')
  return source.slice(bodyAt, end)
}

const at = (haystack, needle) => {
  const i = haystack.indexOf(needle)
  assert.notEqual(i, -1, '面板源码里找不到：' + needle)
  return i
}

test('面板纵向顺序：选择区 → 搜索 → 工具栏 → 列表 → 分页 → 底部主操作区', () => {
  const body = panelBody()
  const order = [
    't("source")',
    't("importTo")',
    't("workspace")',
    'style.searchRow',
    'style.toolbar',
    'style.list',
    'style.pageBar',
    'style.resultBar',
    'style.importBar',
  ].map((needle) => [needle, at(body, needle)])
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i - 1][1] < order[i][1], order[i][0] + ' 应排在 ' + order[i - 1][0] + ' 之后')
  }
})

test('导入按钮置底：主按钮排在列表与分页之后，不再夹在工具栏与列表之间', () => {
  const body = panelBody()
  const primary = at(body, 't("import.selected"')
  assert.ok(primary > at(body, 'style.list'), '导入所选应排在会话列表之后')
  assert.ok(primary > at(body, 'style.pageBar'), '导入所选应排在分页条之后（贴面板底缘）')
  assert.ok(primary > at(body, 'style.toolbar'), '导入所选不应再紧跟工具栏')
})

test('来源 / 导入到 / 工作区三行无分隔线，组边界由搜索行的上边框承担', () => {
  const body = panelBody()
  // 三行都用 rowPlain（无 borderBottom 的行样式）
  assert.equal((body.match(/style\.rowPlain/g) || []).length, 3, '来源/导入到/工作区三行应统一使用 rowPlain')
  assert.equal((body.match(/style\.row\b/g) || []).length, 0, '选择行不应再使用带下边框的 style.row')
  const stylesAt = source.indexOf('const makeStyles = (C) => ({')
  assert.notEqual(stylesAt, -1)
  const styles = source.slice(stylesAt, source.indexOf('function fmtTime', stylesAt))
  const rowPlain = styles.match(/rowPlain:\s*\{([^}]*)\}/)
  assert.ok(rowPlain, 'makeStyles 缺少 rowPlain 定义')
  assert.ok(!/border/.test(rowPlain[1]), 'rowPlain 不得带任何边框：' + rowPlain[1])
  const searchRow = styles.match(/searchRow:\s*\{([^}]*)\}/)
  assert.ok(searchRow, 'makeStyles 缺少 searchRow 定义')
  assert.match(searchRow[1], /borderTop/, 'searchRow 应承担选择区的组边界（borderTop）')
})

test('底部主操作区自带上边框，与列表/分页分区；导入结果条紧贴主按钮之上', () => {
  const stylesAt = source.indexOf('const makeStyles = (C) => ({')
  const styles = source.slice(stylesAt, source.indexOf('function fmtTime', stylesAt))
  const importBar = styles.match(/importBar:\s*\{([^}]*)\}/)
  assert.ok(importBar, 'makeStyles 缺少 importBar 定义')
  assert.match(importBar[1], /borderTop/, '置底后的 importBar 应改画上边框')
  assert.ok(!/borderBottom/.test(importBar[1]), '置底后的 importBar 不应再留下边框')
  const resultBar = styles.match(/resultBar:\s*\{([^}]*)\}/)
  assert.ok(resultBar, 'makeStyles 缺少 resultBar 定义')
  assert.match(resultBar[1], /borderTop/, 'resultBar 应带上边框（与分页条分区）')
  const body = panelBody()
  assert.ok(at(body, 'style.resultBar') < at(body, 'style.importBar'), '导入结果应紧贴主按钮之上')
})
