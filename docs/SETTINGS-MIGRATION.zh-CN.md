# DSH 0.1.5 → 0.1.7 插件设置页迁移

[English](SETTINGS-MIGRATION.md) | 中文

本文整理从 DSH 0.1.5 迁到 0.1.7 时踩到的全部设置页差异，每条都带实测报错原文，可直接转发给其他插件作者。

## 一句话

**0.1.7 删掉了 `settings.register()`。** 0.1.5 里插件可以**按名字**给自己开一个设置命名空间；0.1.7 里「命名空间就是 profile 里的一个条目 id，schema 就是那个条目的 Config」。所以迁移不是改 API，而是**改这个插件在 profile 里的身份**。

## 两版对照

| | 0.1.5 及更早 | 0.1.7 |
|---|---|---|
| 命名空间从哪来 | 插件自己 `settings.register('my-plugin', schema)` | profile 条目 id（[`cordis.patch.yml`](../cordis.patch.yml) 里那条 `- id: …`） |
| schema 从哪来 | 注册时传进去 | 该条目的 `config` 字段，由宿主按插件的 `Config` 导出校验 |
| 客户端怎么读写 | 走 api-proxy 暴露的 settings 通道 | 同上，但**命名空间必须在宿主那份名单里** |

## 三个坑（按踩到的顺序）

### 坑 1：`settings.register` 已经不是函数

**症状**（启动日志，插件若没兜住会直接加载失败）：

```
[modsearch] settings namespace skipped:
  TypeError: scope.settings.register is not a function
```

**修法**：不要再调它。把 schema 作为插件的 `Config` 导出，客户端改用宿主的 settings 服务按**条目 id** 读写。

### 坑 2：条目 id 带**种类前缀**，设置服务只认**裸 id**

这是最坑的一个——报错完全看不出真正原因：

```
POST /my-plugin/prefs
409 settings-conflict
No configurable plugin entry "include:ui-skin-claude-style"
```

**根因**：0.1.7 的 loader 把条目 id 报成 **`<kind>:<id>`**。插件在 profile 里通常是 **`include` / `insert` 条目**，于是 `ctx.fiber.entry.id` 拿到的是 `include:ui-skin-claude-style`；而**设置服务是按裸 id 给命名空间建索引的**——它的命名空间名单里就是 `ui-skin-claude-style`。

用带前缀的名字去写 → 宿主找不到这个条目 → **每次保存都 409**。

**修法**（一行）：

```js
// 0.1.7 报的是 "<kind>:<id>"，设置服务认的是裸 id；没有前缀时是无操作
function entryIdOf(ctx) {
  const id = ctx?.fiber?.entry?.id
  if (typeof id === 'string' && id !== '') {
    const colon = id.lastIndexOf(':')
    return colon === -1 ? id : id.slice(colon + 1)
  }
  return ENTRY_ID_FALLBACK   // patch 里声明的那个 id
}
```

**实测**：修前 `namespaceState = configured:include:ui-skin-claude-style`、写入 409；修后 `configured:ui-skin-claude-style`、写入 `200 {"ok":true,…,"revision":1,"available":true}`。

### 坑 3：`schemastery` 从插件自己的位置解析不到

**症状**：Config 校验拿不到 schema，命名空间注册不上（读能靠默认值兜住，写必失败）。

**原因**：插件常以**软链 / 本地 link** 方式装进 profile，它自己的 `require` 锚点下没有 `@deepseek-ai/schemastery`。

**修法**：把解析锚点指向**运行中的 harness bin**（它旁边一定带着 schemastery），再退回普通解析：

```js
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const anchor = pathToFileURL(process.argv[1]).href   // 如 <npm 全局>/@deepseek-ai/dsh/lib/bin.js
const factory = createRequire(anchor)('@deepseek-ai/schemastery')
// 失败再 await import('@deepseek-ai/schemastery')
```

还有一个**加载期**的坑：`.volatile()` 是 0.1.7 才有的。旧宿主带的 schemastery 没有它，模块顶层直接构造带 volatile 的 `Config` 会在加载期抛 `volatile is not a function`，**整个插件报废**。必须探测后再构造：

```js
function supportsVolatile(S) {
  try { return typeof S.boolean().volatile === 'function' } catch { return false }
}
export const Config = supportsVolatile(Schema) ? Schema.object({ /* … */ }) : undefined
```

## 怎么在任意宿主上自检

写一个只读的自检路由，把这几项吐出来——出问题时光看这一个响应就能定位：

```json
{
  "ok": true,
  "value": { /* 当前设置值 */ },
  "revision": 1,
  "available": true,
  "probe": {
    "hasSettings": true,
    "hasDescribe": true,
    "count": 17,
    "ns": "agent-default-model,llm-pi-ai,…,ui-theme,locale,ui-settings,ui-conversation,…,ui-skin-claude-style",
    "namespaceState": "configured:ui-skin-claude-style",
    "error": null
  }
}
```

判读顺序：

1. `probe.ns` 里**有没有你的裸 id** → 没有就是坑 2 或坑 3
2. `namespaceState` 里是不是**裸 id** → 带 `include:` 之类前缀就是坑 2
3. `hasSettings` / `hasDescribe` → 宿主有没有这套服务（0.1.5 没有，要走旧路径）
4. 写入时带 `revision` 做乐观并发：不匹配会回 `409 settings-conflict`，这是正常的冲突语义，不是 bug

## 兼容写法（一套代码跑两版）

- 启动时探测：宿主有 settings 服务**且你的裸 id 在名单里** → **走 0.1.7 路径**（按条目 id 读写）
- 否则 → **走 0.1.5 旧路径**（插件自持命名空间）
- 两条路径都收敛到同一个「值 + revision」的内存模型，客户端只认这一个模型，就不会出现「读得出来、存不进去」

0.1.7 还移除了旧版的 `scope.watch`：要跟随设置变化，订阅宿主的 `settings/document-updated` 事件（参数为命名空间 id），或直接读 `Config` 里 volatile 字段的 `.get()`。另外可调 `settings.configure({ auto: false }, ctx.fiber)` 声明「本插件自带设置页，不要生成宿主自动页」——它返回 disposer，用 `ctx.effect(() => settings.configure(...))` 登记，别把策略留在服务里。

## 顺带（非设置页，但同一次迁移里会撞到）

- **0.1.7 的插件清单会读 `package.json` 的 `icon`**：必须是相对清单的路径、留在包目录内、≤256 KiB；绝对路径与 URL 一律拒绝。图标以 `<img>` 渲染、**拿不到 `currentColor`**——深色图标在暖黑画布上会消失，建议用有彩度的版本。
- **本地化元数据走 `locale/<语言>.json` 的 `meta.title` / `meta.description`**，且宿主是**逐文件走包 `exports`** 解析的：任何一个 locale 文件没被导出，都会让**整份元数据（含图标）降级成 `meta.error`**。`exports` 里写通配 `"./locale/*"`，别逐文件列举。

## 本仓库的落地

`dsh-chat-import` 已按本文迁移（`lib/import-prefs.mjs` 一套代码跑两版）：

- `Config` 从插件入口（`lib/index.mjs`）导出，三个字段都标 `.volatile()`（0.1.7 只把 volatile 字段投影成可编辑表单）
- 命名空间 = 裸条目 id（`entryIdOf()` 剥离 `<kind>:` 前缀，回退 patch 声明的 `import-claude`）
- 绑定探测：`describe()` 名单含裸 id → `forms`（0.1.7）；只有 `register`/`get` → `legacy`（0.1.5，命名空间 `chat-import`）；都没有 → `none`（读默认、写不持久化）
- 面板路由 `/api-import/prefs` 的响应带 `probe` 自检块
