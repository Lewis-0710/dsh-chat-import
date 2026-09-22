# Changelog

All notable changes to `dsh-chat-import` are documented here, newest first.

## [Unreleased]

- 导入面板的多选入口从「点行首来源工具标」改为「点整行任意处」：行首 22px 的方图不再是勾选位（只作来源标识与选中态指示），点行内任意处即勾选，键盘聚焦后用 Enter / 空格切换；行内导入 / 同步按钮保持不变，点它只导入、不连带勾选。

## [0.19.0] - 2026-09-21

[中文](#cn-0.19.0) | [English](#en-0.19.0)

<h3 id="cn-0.19.0">新增功能</h3>

- 会话发现支持「全部来源」流式加载：扫描结果按发现顺序逐条推入列表，首屏不再等全量扫描结束；扫描完成后一次性重排为最近活跃倒序。
- 导入面板新增**筛选：路径**（原工作区筛选，标签化）与**筛选：时间**（24 小时 / 7 天 / 30 天 / 不筛选，按最后活跃或创建时间过滤）。
- 分页档位改为 **500 / 2000 / 全部**（默认 500）：「全部」即不分页，10 万行实测 DOM 恒为 19 行 / 351 节点、悬停与勾选 0.6ms。
- 页码改成「第 x / y 页」控件，点开在底栏上方弹出**页码网格**（点数字直接跳页，页多时网格自滚动并停在当前页附近）。

### 体验优化

- 会话列表改为**窗口化渲染**：行高 28px + 行距 1px 与组头 34px 都是固定值，可见区间纯算术得出，只挂载可视区上下各一屏，其余用等高占位块撑住（滚动高度与 sticky 组头行为不变）。
- 会话行抽成 memo 组件、回调走 ref 转存、派生数据全部 `useMemo`：悬停或勾选一次只重建受影响的那一行；大档位下两处「每次渲染 O(n)」开销收敛，10 万行时一次悬停从 8ms 降到 0.6ms。
- 会话列表改成一行式，与皮肤的工作区列表同一套口径（行高 / 圆角 / 标题字号与配色一致）：行首来源工具标既是来源标识也是多选勾选位，右侧相对时间；上下文 / 分支 / 导入状态收进悬停提示，单条导入按钮悬停时才出现在时间位置。
- 扫描状态与分页条合并成列表下方一条：扫描中显示「已发现 N 个」，完成后显示页码与总数；总数不足一档时连「每页」选择器一起隐藏。
- 工具栏动作按钮的折叠判据改为「动作按钮组实测可用宽度」而不是面板宽度：用隐藏探针量出文字形态所需宽度再比对，文字形态不再折行（挤不下走省略号兜底）。
- 列表窗口化的上下余量从「±10 行」提高到「±一屏」，快滚不再露白。
- **发现层不再为消息条数整读**（面板已不展示该字段）：SQLite 源（opencode 系 / zcode / hermes）改走会话摘要读取器，只查 session 表加每会话一条「最近消息时间」聚合，不再逐会话读出 message/part 正文并逐 cell 解析——本机 zcode 单次同步阻塞 185ms → 1ms，正是面板卡顿的来源之一。
- DSH 会话的 `.zstd` 正文改走 **node:zlib 原生异步 zstd 解码**（libuv 线程池，Node < 22.15 自动回退 fzstd）：本机 60 个会话实测同步阻塞 3.8s → 异步 0.2s，事件循环不再被顶住。
- 发现层尾部读取（claude / kimi 的 context token）改为 chunks 数组滚动窗口：原实现每块都对整条尾串全量复制，大 transcript 的尾部读取开销主要在这块 memcpy。
- 本机实测（含 26 种来源、约 1.35 GB 数据）：冷扫描 5002ms → 1438ms，事件循环最大漂移 104ms → 0ms，书签命中重扫 375ms → 150ms。

### 问题修复

- 修复窄面板下工具栏按钮被压扁、文字折行的问题（折叠判据改用实测宽度，见上）。
- 修复快滚列表时偶发露白：窗口化余量由固定 10 行改为按视口高度计算。

### 其他变更

- 客户端 bundle 构建脚本改为**原子写** `lib/client.js`（同目录临时文件 + rename）：宿主按 stat 轮询该文件、一变就重新加载并按内容哈希发版（带一年 immutable 缓存），直接覆写会留出「读到半截 bundle」的窗口。另加 `--out=<path>` 供测量/实验构建写到 `lib/` 之外。
- `scan_discover` 输出条目与 schema 去掉 `messageCount`（面板已不展示；SQLite 摘要读取器同步不再产出该字段）。
- README 增补通过 GUI 导入的界面预览（亮 / 暗各一张），并新增 `screenshots.json` 商店截图清单。
- `package.json` 的 `files` 增补 `docs/*.png`，让 npm 页面上的 README 也能显示预览图。

<h3 id="en-0.19.0">New Features</h3>

- Streaming discovery for "All sources": scan results are appended in discovery order so the first screen no longer waits for the full scan; once the scan finishes the list is re-sorted by most-recent activity.
- Add **Filter: path** (the former workspace filter, now label-style) and **Filter: time** (24 hours / 7 days / 30 days / any time, by last activity or creation) to the import panel.
- Page sizes are now **500 / 2000 / All** (500 by default): "All" drops pagination — with 100k rows the DOM stays at 19 rows / 351 nodes, with 0.6ms hover and selection.
- The page number becomes a "Page x / y" control that opens a **page grid** above the status bar for one-click jumps; the grid scrolls on its own when there are many pages.

### Improvements

- The session list is now **windowed**: fixed row (28px + 1px gap) and group-header (34px) heights make the visible range pure arithmetic, so only the rows within one screen above and below the viewport are mounted and the rest are held by equal-height spacers (scroll height and sticky group headers unchanged).
- Session rows became memo components with ref-stashed callbacks and fully memoised derived data: a hover or a checkbox toggle rebuilds only the affected row; the two per-render O(n) costs on large tiers were removed, cutting a hover from 8ms to 0.6ms at 100k rows.
- Session rows became single-line and now follow the same metrics as the skin's workspace list (matching height, radius, title size and colours): the leading source mark is both the source label and the multi-select checkbox, the relative time sits on the right, and context / branch / import status moved into the hover tooltip, with the per-row import button appearing in the timestamp's place on hover.
- Scan progress and pagination merged into one status line under the list: it reports "N found" while scanning and page / total once done; below one full page the per-page selector is hidden too.
- Toolbar action buttons now collapse based on the **measured width available to the button group** instead of the panel width: a hidden probe measures the width the text form needs, so labels no longer wrap (they fall back to an ellipsis when truly out of room).
- The windowing overscan grew from "±10 rows" to "±one screen", so fast scrolling no longer flashes blank rows.
- **Discovery no longer reads whole SQLite transcripts just to count messages** (the panel no longer shows that field): opencode-family / zcode / hermes sources now use per-session summary readers that only query the session table plus one "latest message time" aggregate, instead of loading every message and part and parsing each cell — on this machine zcode's single blocking read dropped from 185ms to 1ms, one of the causes of panel jank.
- DSH `.zstd` session bodies now decode through **node:zlib's native async zstd** (libuv thread pool, with an automatic fzstd fallback on Node < 22.15): measured on this machine, 60 sessions went from 3.8s of synchronous blocking to 0.2s of async work, so the event loop is no longer stalled.
- Tail reads in discovery (claude / kimi context tokens) now use a chunk-array rolling window: the previous implementation copied the entire accumulated tail on every chunk, and that memcpy was the bulk of the cost on large transcripts.
- Measured on this machine (26 sources, ~1.35 GB of data): cold scan 5002ms → 1438ms, worst event-loop drift 104ms → 0ms, bookmark-hit rescan 375ms → 150ms.

### Bug Fixes

- Fix toolbar buttons being squeezed and their labels wrapping on a narrow panel (the collapse rule now uses a measured width, see above).
- Fix occasional blank rows while fast-scrolling: the windowing overscan is now computed from the viewport height instead of a fixed 10 rows.

### Chores

- The client bundle build script now writes `lib/client.js` **atomically** (same-directory temp file + rename): the host polls that file by stat, reloads whenever it changes and publishes by content hash with a one-year immutable cache, so a plain overwrite leaves a window where a half-written bundle is read. Added `--out=<path>` so measurement / experiment builds land outside `lib/`.
- `scan_discover` entries and schema no longer carry `messageCount` (the panel does not show it, and the SQLite summary readers stop producing it).
- README now includes GUI-import previews (one light, one dark) plus a `screenshots.json` store manifest.
- `package.json` `files` now includes `docs/*.png` so the previews also render on the npm page.

**Full Changelog**: [v0.18.5...v0.19.0](https://github.com/Nwflower/dsh-chat-import/compare/v0.18.5...v0.19.0)

## [0.18.5] - 2026-09-21

- 面板选择区改为一行读完「从 全部来源 导入到 DSH 会话环境」：来源与落点合到同一行、「从」与「导入到」当连接词，工作区另起一行；触发器只留文本（去掉下三角与品牌标，品牌 SVG 标只在下拉弹层行里显示），弹层统一对着这一行定位（行宽 = 弹层宽，窄面板也不会溢出）。
- 工作区下拉里在文件夹名之后用更淡的小字画出绝对路径（宽度不够先截断路径：主标签不参与收缩，文件夹名保持完整，只有它自己超过行宽时才截断；全文留在 title；搜索也匹配路径）；整份选项都没有品牌标时不再保留行首 16px 图标槽位，工作区列表的文字左移贴边。
- 下拉弹层高度改为自适应窗口：列表上限按「视口底部 − 弹层顶端」实测（原来写死 260px），来源列表一屏从 8 行提到近 20 行，短列表仍随内容收缩。
- 选择区只留一行；工作区筛选移到工具栏末位（与动作按钮分组，窄面板下不降级成图标），选择区上下高度提到与其他两层一致（三行统一 8px 12px 内边距）；工具栏去掉「已选 N」（底部主按钮「导入所选 (N)」已经承担）；三个下拉的边框改为与工具栏按钮同款（1px border-l2 + 8px 圆角），内边距收窄。
- 导入面板下拉控件按模型选择器式二级弹层重绘：触发器去掉输入框外观，hover / 展开时浮出一层背景矩形；弹层改为紧凑行（30px 行高、6px 行圆角、行首品牌标、当前项末尾 ✓），搜索框与列表之间加一条分隔线。来源 / 导入到 / 工作区三个下拉统一。
- 导入面板改版：导入按钮移到面板底缘（列表与分页之下），滚动时始终可见；来源 / 导入到 / 工作区三行之间不再画分隔线，三行合并为一组。
- 修复 Antigravity 导入崩溃（`The "path" argument must be of type string …`）：工具层旁读 annotation / 任务回执改为宿主 fs 目标对象契约（先 `resolve` 再 `readText`/`listDir`），单文件与批量导入不再全灭。
- Antigravity 发现迁移到新版存储根 `~/.gemini/antigravity`，旧 CLI 根 `~/.gemini/antigravity-cli` 与 IDE 根 `~/.gemini/antigravity-ide` 继续并扫；`.db`/`.pb` 会话文件按会话 id 去重发现。
- Antigravity 目录批量只收集 canonical `transcript.jsonl`，不再把 `transcript_full.jsonl` 等伴生日志当作独立会话。

## [0.18.4] - 2026-09-20

- 环境变更提示改到首个 `step/start` 之后：旧格式（v0–v2）导入会话不再因宿主 v2→v3 格式迁移被拒载（surface 事件早于首个 step 的形状会被迁移器 fail-closed 拒绝）。
- `verify_session` 新增 `surface-before-first-step` 检查与重导提示：存量旧格式会话被点名，不再等宿主迁移时才暴露。
- 增量续写不再重复注入环境变更提示。
- Kimi Code 缺少 `state.json` 时保留工作区归属。
- 失效旧版 scan-cache，修复 Grok Build 工作区名仍显示 %XX。
- 导入面板图标选中态遮罩按强调色明度选黑/白。

## [0.18.3] - 2026-09-18

- 接入官方原生右侧栏，移除旧版右侧栏与自绘 ShellPanel 回落链。
- 修复 SQLite WAL 盲区与 DB 指纹短路径。
- 修复 `warmProjection` 宿主三参契约调用。
- 用 npm 10 重新生成 lockfile，修复 CI `npm ci` 依赖树漂移。
- Grok Build 工作区列不再显示 %XX 编码乱码。
- 去 AI 化清理：删除未消费层、统一文档计数、移除内部编号。

## [0.18.2] - 2026-09-17

- 修复 ChatGPT 官方导出静默丢弃：兼容缺失 children、占位 root、浮点时间戳。
- `verify_session` 增加非整数时间检查。

## [0.18.1] - 2026-09-17

- 新增 TeleAgent 来源。
- 数据库类批量来源的会话标题统一为「来源 · 话题」。

## [0.18.0] - 2026-09-17

- 面板新增「导入到」下拉：直投 Claude Code / Codex / Kimi Code / opencode。
- 新增 opencode 反向导出。

## [0.17.3] - 2026-09-17

- 修复 Codex 分页链扫描按 thread 过滤。
- 支持 Kimi 新版 `state.json` 的 `workDir` 字段。
- 清理/重导支持带下划线会话 ID。

## [0.17.1] - 2026-09-16

- 修复 Codex 分页 rollout 按 thread 成链导入。

## [0.17.0] - 2026-09-15

- 新增 Crush 来源。

## [0.16.0] - 2026-09-15

- 新增 Zed Agent 来源。

## [0.15.0] - 2026-09-15

- 新增 Goose 来源。

## [0.14.0] - 2026-09-15

- 新增 Cline 来源。

## [0.13.0] - 2026-09-15

- 新增 Continue 来源。

## [0.12.x] - 2026-09-15

- 继续完善来源支持、面板与同步能力；详细历史见 git。

## [0.11.x] - 2026-09-07 ~ 2026-09-15

- 继续新增来源、面板、导出与同步能力；详细历史见 git。

## [0.10.x] - 2026-09-06 ~ 2026-09-07

- 持续完善导入、发现与导出能力；详细历史见 git。

## [0.9.x] - 2026-09-04 ~ 2026-09-06

- 继续完善工具面与文档；详细历史见 git。

## [0.8.x] - 2026-08-26 ~ 2026-09-01

- 新增增量续写、扫描缓存、标题兜底、上下文桥接等能力；详细历史见 git。

## [0.7.x] - 2026-08-23

- 继续完善导入能力与工程基建；详细历史见 git。

## [0.6.x] - 2026-08-17 ~ 2026-08-19

- 继续完善来源支持与互转能力；详细历史见 git。

## [0.5.x] - 2026-08-16

- 继续完善导入与发布流程；详细历史见 git。

## [0.4.0] - 2026-08-16

- 发布规范达标，完善插件元数据与工程配置。

## [0.3.x] - 2026-08-14

- 完善仓库社区健康与工程规范。

## [0.2.0] - 2026-08-14

- 收口版本漂移，补齐 Reasonix/opencode 等能力。

## [0.1.x] - 2026-08-13 ~ 2026-08-14

- 首个发布版本，支持早期外部 Agent 会话导入。
