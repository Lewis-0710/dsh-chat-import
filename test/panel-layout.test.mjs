// panel-layout.test.mjs — 导入面板骨架（lib/client.js 内联 JSX 源码）的结构契约：
// 面板按「选择区 → 筛选层 → 工具栏 → 列表 → 分页 → 底部主操作区」自上而下排布：
// 选择区只有一行、读成「从 全部来源 导入到 DSH 会话环境」（「从」与「导入到」当连接词、
// 行内不画分隔线），工作区筛选并入筛选层与搜索框同排，工具栏只留选择类动作
//（已选条数由底部主按钮的「导入所选 (N)」承担，不再单独占一个 label）。
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

test('面板纵向顺序：选择区 → 筛选层 → 工具栏 → 列表 → 分页 → 底部主操作区', () => {
  const body = panelBody()
  const order = [
    'style.rowPlain',
    't("from")',
    't("source.title")',
    't("importTo")',
    'style.searchRow',
    'style.toolbar',
    't("workspace.title")',
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

test('选择区只剩一行（来源 + 落点），无分隔线（组边界由筛选层的上边框承担）', () => {
  const body = panelBody()
  // 选择区一行用 rowPlain（无 borderBottom 的行样式）
  assert.equal((body.match(/style\.rowPlain/g) || []).length, 1, '选择区只有「来源 + 落点」一行，应使用 rowPlain')
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

test('选择区一行读完：来源下拉 → 连接词「导入到」→ 落点下拉；工作区筛选在筛选层', () => {
  const body = panelBody()
  const selects = [...body.matchAll(/SearchableSelect/g)].map((m) => m.index)
  assert.equal(selects.length, 3, '面板应有来源 / 落点 / 工作区三个下拉')
  const joins = [...body.matchAll(/style\.rowJoin/g)].map((m) => m.index)
  assert.equal(joins.length, 2, '本行有两个连接词：「从」与「导入到」')
  assert.ok(joins[0] < selects[0], '「从」应排在来源下拉之前')
  assert.ok(selects[0] < joins[1] && joins[1] < selects[1], '「导入到」应夹在来源与落点两个下拉之间（同一行）')
  const toolbarAt = at(body, 'style.toolbar')
  const listAt = at(body, 'style.list')
  assert.ok(toolbarAt < selects[2] && selects[2] < listAt, '工作区筛选挂在工具栏末位，排在列表之前')
  const toolbar = body.slice(toolbarAt, listAt)
  assert.equal((toolbar.match(/toolBtn\(/g) || []).length, 5, '工具栏的五个动作按钮走 toolBtn')
  assert.ok(toolbar.indexOf('t("workspace.title")') > toolbar.lastIndexOf('toolBtn('),
    '工作区筛选不是 toolBtn 条目：窄面板下工具按钮降级成图标时它仍保持文字')
  assert.equal(body.includes('selected.count'), false, '已选条数由底部主按钮承担，工具栏不再重复显示')
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
