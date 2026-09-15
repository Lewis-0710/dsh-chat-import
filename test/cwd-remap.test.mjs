// cwd-remap.test.mjs — REQ-74 cwd 重映射单测。
//
// 背景：宿主用平台相关的 isAbsolute 校验 header.cwd（dsh-session/lib/index.js:786），
// 所以源机路径（如 Windows 的 D:\demo\proj 在 POSIX 上）在 prepareHostMeta 处被剔除，
// 会话退化为未分组。那个取舍是刻意的，本选项不推翻它——只给用户一个把源前缀改写成
// 本机前缀的机会，改写结果仍要过同一道绝对性校验。
//
// 本文件只覆盖重映射本身的语义与接线，不重复既有导入流程的用例。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { applyCwdRemap, attachReq26, finalizeConvertedSession } from '../lib/import-core.mjs'

const conv = (cwd) => ({ meta: { id: 'import-x', cwd }, turns: [], events: [] })

test('未传 cwdRemap 时完全不碰 meta（默认不启用，既有行为不变）', () => {
  for (const args of [{}, { cwdRemap: undefined }, { cwdRemap: [] }, { cwdRemap: null }, { cwdRemap: 'x' }]) {
    const out = conv('D:\\demo\\proj')
    applyCwdRemap(out, args)
    assert.equal(out.meta.cwd, 'D:\\demo\\proj')
    assert.equal(out.cwdRemap, undefined)
  }
})

test('命中规则：前缀被改写为 to，其余部分按本机分隔符拼接', () => {
  const out = conv('D:\\demo\\proj')
  applyCwdRemap(out, { cwdRemap: [{ from: 'D:\\demo', to: '/Users/me/demo' }] })
  assert.equal(out.meta.cwd, '/Users/me/demo/proj')
  assert.deepEqual(out.cwdRemap, {
    from: 'D:\\demo',
    to: '/Users/me/demo',
    original: 'D:\\demo\\proj',
    mapped: '/Users/me/demo/proj',
    absolute: true,
  })
})

test('cwd 恰好等于 from 时映射为 to 本身', () => {
  const out = conv('D:\\demo')
  applyCwdRemap(out, { cwdRemap: [{ from: 'D:\\demo', to: '/Users/me/demo' }] })
  assert.equal(out.meta.cwd, '/Users/me/demo')
})

test('长前缀优先：/a 不得抢先命中 /a/b 下的路径', () => {
  const out = conv('D:\\demo\\proj\\src')
  applyCwdRemap(out, {
    cwdRemap: [
      { from: 'D:\\demo', to: '/short' },
      { from: 'D:\\demo\\proj', to: '/long' },
    ],
  })
  assert.equal(out.meta.cwd, '/long/src', '规则按 from 长度降序匹配')
})

test('前缀边界：from 必须落在分隔符上，D:\\demo 不得命中 D:\\demolition', () => {
  const out = conv('D:\\demolition\\x')
  applyCwdRemap(out, { cwdRemap: [{ from: 'D:\\demo', to: '/x' }] })
  assert.equal(out.meta.cwd, 'D:\\demolition\\x', '未命中则原样保留')
  assert.equal(out.cwdRemap, undefined)
})

test('未命中任何规则时不做任何改动', () => {
  const out = conv('/already/local/proj')
  applyCwdRemap(out, { cwdRemap: [{ from: 'D:\\demo', to: '/x' }] })
  assert.equal(out.meta.cwd, '/already/local/proj')
  assert.equal(out.cwdRemap, undefined)
})

test('规则里的首尾分隔符与正斜杠写法都能用', () => {
  const a = conv('D:\\demo\\proj')
  applyCwdRemap(a, { cwdRemap: [{ from: 'D:\\demo\\', to: '/local/demo/' }] })
  assert.equal(a.meta.cwd, '/local/demo/proj', '尾部斜杠被归一')

  const b = conv('D:/demo/proj')
  applyCwdRemap(b, { cwdRemap: [{ from: 'D:/demo', to: '/local/demo' }] })
  assert.equal(b.meta.cwd, '/local/demo/proj', '正斜杠写法同样命中')
})

test('畸形规则被忽略，不影响合法规则', () => {
  const out = conv('D:\\demo\\proj')
  applyCwdRemap(out, {
    cwdRemap: [null, {}, { from: '' }, { from: 'D:\\demo' }, { to: '/x' }, { from: 'D:\\demo', to: '' },
      { from: 'D:\\demo', to: '/ok' }],
  })
  assert.equal(out.meta.cwd, '/ok/proj')
})

test('幂等：重复调用保持首次结果，不叠加', () => {
  const out = conv('D:\\demo\\proj')
  const args = { cwdRemap: [{ from: 'D:\\demo', to: '/local/demo' }] }
  applyCwdRemap(out, args)
  const first = out.meta.cwd
  applyCwdRemap(out, args)
  applyCwdRemap(out, { cwdRemap: [{ from: '/local/demo', to: '/other' }] })
  assert.equal(out.meta.cwd, first, '第二次改写不再生效')
})

test('to 用外来分隔符时结果非本机绝对，如实记为 absolute:false（随后由 prepareHostMeta 剔除）', () => {
  // to 应当是**本机**路径。这里故意给一个 Windows 形式，验证两件事：
  // 1) 余下部分按本机 join 拼接，所以出现混合分隔符（E:\other/proj）——这是 join 的
  //    既有行为，不是本选项引入的；
  // 2) 结果过不了 isAbsolute（POSIX 上为 false），于是照旧被 prepareHostMeta 剔除、
  //    会话退化未分组。重映射不绕过宿主校验，把事实记进 cwdRemap.absolute 供上报。
  const out = conv('D:\\demo\\proj')
  applyCwdRemap(out, { cwdRemap: [{ from: 'D:\\demo', to: 'E:\\other' }] })
  assert.equal(out.meta.cwd, 'E:\\other/proj')
  assert.equal(out.cwdRemap.absolute, false, '不静默：非绝对的事实要被记下')
})

test('meta 缺失或 cwd 非字符串时安全返回', () => {
  for (const out of [{}, { meta: {} }, { meta: { cwd: 42 } }, { meta: { cwd: '' } }, null]) {
    assert.doesNotThrow(() => applyCwdRemap(out, { cwdRemap: [{ from: 'D:\\demo', to: '/x' }] }))
  }
})

test('接线：finalizeConvertedSession 应用重映射；attachReq26 把结果透出到返回值', () => {
  const out = conv('D:\\demo\\proj')
  finalizeConvertedSession(out, { cwdRemap: [{ from: 'D:\\demo', to: '/local/demo' }] })
  assert.equal(out.meta.cwd, '/local/demo/proj', 'finalize 阶段即改写（早于落盘与归组）')

  const res = attachReq26(out, { sessionId: 'import-x', turns: 0, messages: 0, toolCalls: 0, skipped: 0 })
  assert.deepEqual(res.cwdRemap, out.cwdRemap, '重映射事实进入返回值，可被观察')

  const plain = attachReq26(conv('/local/x'), { sessionId: 'y' })
  assert.equal(plain.cwdRemap, undefined, '未启用时不占键')
})
