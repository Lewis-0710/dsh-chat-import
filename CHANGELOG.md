# Changelog

All notable changes to `dsh-chat-import` are documented here, newest first.

## [Unreleased]

[中文](#cn-unreleased) | [English](#en-unreleased)

<h3 id="cn-unreleased">新增功能</h3>

- 会话写入按**宿主会话格式版本分流**：工具结果在 V3 写成 `role: 'user'` 内的 `tool-result` 包装，在 V4 写成顶层 `role: 'tool'` 消息。版本取自宿主 `sessionPersistence` 能力位（`formatVersion`/`currentVersion`），探不到时取已持久化会话 header 的最高版本，再兜底 V3——已装 V3 宿主的行为与产物不变。
- 读取侧（反向导出、校验、Markdown 渲染）改为**形状无关**：`toolResultOf` 是唯一的工具结果读取入口，V3 与 V4 两种形状的会话都能导出与校验。此前只认 V3 包装，V4 会话的工具结果会被整体跳过。
- `verify_session` 新增三类 **V4 迁移风险**检查：`unadvertised-tool-call`（调用无 assistant 消息内容块广告）、`cross-step-result`（结果闭合在调用所在 step 之外）、`duplicate-tool-result`（同一调用多条结果）；`orphan-tool-result` 的修复提示升级为点名迁移拒载风险。append-only 不改写既有日志，修复路径为 force 重导——可在宿主升级 V4 之前完成。
- 新增**忽略（墓碑）表**：归档会话、撤回 / 删除导入、删除工作区都会自动登记对应源为忽略，重扫、`/import-all` 与自动同步不再把它带回来。取消归档自动解除；删除工作区忽略的是**删除时**其名下已导入的会话，该工作区出现新会话或其中会话取消归档时自动恢复工作区（更早的墓碑保留）。
- 新增命令 **`/ignores`**（查看）、**`/ignore <sessionId|sourcePath>`**（手动忽略）、**`/unignore <sessionId|sourcePath|all>`**（解除）。`force: true` 仍可显式越权导入一次（不解除墓碑）。
- 忽略表落盘 `$DSH_HOME/dsh-chat-import/ignores.json`；文件损坏按空表降级，不阻塞导入主流程。

### 体验优化

- 导入面板的来源下拉与会话行改用**官方品牌标**（商标归各自权利人）：18 个取自 @lobehub/icons（MIT），Reasonix / Continue / Zed 取自各自 GitHub 仓库的官方标，ChatGPT 用 OpenAI 标、MimoCode 用 XiaomiMiMo 标。mark 按实测 ink 包围盒归一化后放进 16px 槽位、字标字面高统一——整列图标一样大、文字都从同一列（24px）起；会话行的白卡标换成同一份官方标，此前手绘的 26 份来源标只剩 3 份。字标拼的不是我们展示的名字的（Hermes / ZCode / DSH 展示工具名而非厂商名）仍退回「品牌标 + 标签文本」；WorkBuddy（原仓库已不可达）、TeleAgent（产品页无矢量标）、Crush（仓库里只有演示 GIF / PNG）保留手绘缩写卡。
- 导入面板的多选入口从「点行首来源工具标」改为「点整行任意处」：行首 22px 的方图不再是勾选位（只作来源标识与选中态指示），点行内任意处即勾选，键盘聚焦后用 Enter / 空格切换；行内导入 / 同步按钮保持不变，点它只导入、不连带勾选。

### 问题修复

- 修复 **V4 宿主读不回导入日志**：V4 退役了 `source.kind = 'plugin'`（宿主迁移器把 `{kind:'plugin', plugin:'X'}` 改写成生产者自有 kind `plugin:X`，读路径对 V4 直接拒绝 `plugin`），而导入自产的上下文注入与 system head 都写 `kind:'plugin'`——写 V4 时按同一规则改写（`@deepseek-ai/dsh-system-prompt` + system 角色映射为 `system-prompt`，其余为 `plugin:<name>`），V3 保持原样。实测：合成日志现在通过宿主自己的 `assertReleasedV4Relationships` / `assertReleasedV4Header` / `assertV4RowAdmission`（13 行 0 失败）。
- 修复 **V3 导入的会话在 V4 宿主上打不开**（`system/message requires a protected first surface head`）：宿主的 v3→v4 迁移要求 surface 的第一个事件是 `system/message`（protected head），而导入会话此前从 `user/message` 起，宿主续聊写自己的系统提示词时整份日志被拒载——由它 seed 出来的续聊会话同样打不开（原生会话创建时就写了 head，所以不受影响）。现在导入在首个 `step/start` 之后写一条空 `system/message` head（位置与内容对齐宿主自己的 v2→v3 迁移器）。`verify_session` 新增 `system-head-missing` 检查点名 0.20.0 之前导入的存量会话，`force: true` 重导即可修复——head 必须是 surface 首事件，旧日志无法原地补写。同时把事件类型白名单对齐到宿主当前词汇表（补 `system/message`、`developer/message`、`assistant/attempt`、`model/selection`、`subagent/catalog`、`deliverables/presented`、`image/offload`、`workspace/changes`、`tool/ptc-dispatch*` 等），并让问题按 seq 排序上报——此前白名单滞后会把宿主合法事件误报成 `unknown-type`、把真正的结构问题挤出 20 条上报上限。
- 导入会话的工具结果统一闭合在**调用所在 step 内**：跨 step / 跨轮到达的异步结果提前到其 `tool/call` 旁。DSH 消息投影不重排（事件顺序即 wire 顺序），此前这类日志在调用 step 留下未闭合调用，投影出现「assistant 带 tool_calls 但无后续 tool 消息」的非法序列——续聊被模型 API 拒绝，宿主升 V4 后迁移同样拒载。
- 无广告调用的**孤儿结果**（转录中途开始）与同一调用的**重复结果**改为丢弃并计数（`orphanToolResults` / `duplicateToolResults`，零值不占键；与 interchange 管线的丢弃策略同口径），单条导入结果与批量明细均透传。此前两者原样写入，宿主升 V4 后迁移 fail-closed 拒载。
- 修复深色主题下导入面板的**弹层透出背后列表**：宿主的菜单面 `--dsw-specific-menu` 在深色下是半透明的（`#30313680`），宿主的 Menu 靠 `--dsw-menu-backdrop-filter` 的背景模糊把它做成玻璃卡片——插件此前只用了颜色没上模糊，于是深色下能直接读到后面的会话标题（浅色被皮肤定成不透明白，所以只有深色露馅）。下拉弹层与页码网格补上模糊 + 宿主投影；sticky 分组头与历史确认框改用不透明的 `--dsw-alias-bg-layer-3`（sticky 头必须挡住滚过来的行）。

### 其他变更

- 宿主广告**未知的更高会话格式版本（V5+）**时，写盘前大声告警一次（仍按已知最高版本产出）：插件的形状分支是「一版一支」，不假设 `>= 4` 都同形——宿主换版时让用户先看到「插件还没跟进 N」，而不是只看到一次导入失败。
- **撤回 / 删除后重导不再自动发生**：`retract_import` 与清理（purge）现在写入永久墓碑，重导同一源返回 `ignored`；需要恢复时用 `/unignore`。
- 归档会话不再被视为「可重导」：归档即写 `archived` 墓碑（取消归档解除），取代此前「另铸后缀新 id 重导」的行为。

<h3 id="en-unreleased">New Features</h3>

- Session writes are split by the **host session format version**: tool results are written as a `tool-result` wrapper inside a `role: 'user'` message on V3 and as a top-level `role: 'tool'` message on V4. The version comes from the host's `sessionPersistence` capability (`formatVersion`/`currentVersion`), falls back to the highest version seen in persisted session headers and then to V3 — an installed V3 host keeps producing exactly what it did before.
- The read side (reverse export, verification, Markdown rendering) is now **shape-agnostic**: `toolResultOf` is the single entry point for reading tool results, so V3 and V4 sessions both export and verify. Previously only the V3 wrapper was understood and a V4 session's tool results were skipped entirely.
- `verify_session` gained three **V4 migration risk** checks — `unadvertised-tool-call` (a call with no advertising assistant content block), `cross-step-result` (a result closed outside its call's step) and `duplicate-tool-result` (more than one result for the same call); the `orphan-tool-result` hint now names the migration refusal risk. Logs stay append-only: the fix is a `force` re-import, which can be done before upgrading the host.
- **Ignore (tombstone) table**: archiving a session, retracting/purging an import, or removing a workspace now auto-registers the affected sources as ignored, so rescans, `/import-all`, and the automatic sync skip them. Unarchiving clears the archive tombstone; removing a workspace ignores the sessions it held **at that moment** and restores the workspace when a new session appears or one of its sessions is unarchived (earlier tombstones stay).
- New commands **`/ignores`**, **`/ignore <sessionId|sourcePath>`**, **`/unignore <sessionId|sourcePath|all>`**. `force: true` still imports once despite a tombstone without clearing it.
- The ignore table lives at `$DSH_HOME/dsh-chat-import/ignores.json`; a damaged file degrades to an empty table without blocking the import pipeline.

### Improvements

- Source brand marks are now the **official** ones (trademarks belong to their owners): 18 come from the @lobehub/icons static SVG package (MIT), Reasonix / Continue / Zed from their own GitHub repositories, ChatGPT from lobehub's OpenAI mark and MimoCode from its XiaomiMiMo mark. Each mark's ink box is normalised into a 16px slot and every wordmark shares one cap height, so the column is one size and all text starts at the same x (24px); session rows use the same official art on their white cards, and only three hand-drawn marks remain (WorkBuddy's repository is gone, TeleAgent's product page has no vector logo, Crush ships only demo GIFs).
- Multi-select moved from the leading source mark to **the whole row**: the 22px square is no longer the checkbox (it only names the source and shows selection state) — clicking anywhere on the row toggles selection, and Enter / Space does the same once the row has focus. The per-row import / sync button is unchanged: it imports without toggling.

### Bug Fixes

- Fix **V4 hosts refusing to read back imported logs**: V4 retires `source.kind = 'plugin'` (the host migrator rewrites `{kind:'plugin', plugin:'X'}` to the producer's own kind `plugin:X`, and the read path rejects `plugin` outright), while the import's own context injection and system head wrote `kind:'plugin'` — the V4 write path now rewrites them by the same rule (`@deepseek-ai/dsh-system-prompt` with a system role maps to `system-prompt`, everything else to `plugin:<name>`); V3 is untouched. Verified: a synthesized log now passes the host's own `assertReleasedV4Relationships` / `assertReleasedV4Header` / `assertV4RowAdmission` with zero failing rows.
- Fix **V3-imported sessions that a V4 host refuses to open** (`system/message requires a protected first surface head`): the host's v3→v4 migration requires the first surface event to be a `system/message` (the protected head), but imported logs started with a `user/message`, so the host's own system message on the next turn made the migrator refuse the whole log — and sessions seeded from it failed the same way (native sessions write the head at creation, which is why they were unaffected). Imports now write an empty `system/message` head right after the first `step/start`, matching the position and shape of the host's own v2→v3 migrator. `verify_session` gained a `system-head-missing` check that names sessions imported before 0.20.0; a `force: true` re-import fixes them — the head must be the first surface event, so an existing log cannot be repaired in place. The event-type whitelist was also aligned with the host's current vocabulary (adding `system/message`, `developer/message`, `assistant/attempt`, `model/selection`, `subagent/catalog`, `deliverables/presented`, `image/offload`, `workspace/changes`, `tool/ptc-dispatch*` and more) and problems are now reported in seq order — the stale whitelist used to report legitimate host events as `unknown-type` and push the real structural problem past the 20-problem cap.
- Tool results are now closed **inside the step of their call**: async results arriving across steps or turns are emitted next to their `tool/call`. DSH's message projection does not reorder (event order is wire order), so such logs previously left an unresolved call in the call's step and the projection contained an illegal "assistant with tool_calls but no following tool message" sequence — the model API refused the conversation, and the host's V4 migration refused it too.
- **Orphan results** (a transcript that starts mid-conversation) and **duplicate results** for the same call are now dropped and counted (`orphanToolResults` / `duplicateToolResults`; zero values take no key, the same policy as the interchange pipeline), and both counts are reported on single and batch imports. Previously they were written as-is and the host's V4 migration refused the session.
- Fix the dropdown **leaking the list behind it** in dark theme: the host menu surface `--dsw-specific-menu` is translucent in dark (`#30313680`) and the host's own Menu pairs it with `--dsw-menu-backdrop-filter`; the plugin only used the colour, so the session titles behind stayed readable (the light theme is opaque white in the skin, which is why only dark showed it). The dropdown and page grid now carry the host's blur + elevation; the sticky group header and the history confirm dialog use the opaque `--dsw-alias-bg-layer-3` (a sticky header must cover the rows scrolling under it).

### Chores

- When the host advertises an **unknown, newer session format version (V5+)**, the write path warns loudly once and emits the highest known shape: the plugin's shape branches are one-per-version and it does not assume everything from 4 on is the same, so a host bump surfaces as "the plugin has not caught up with N" rather than a bare import failure.
- **Re-import after retract/delete no longer happens automatically**: `retract_import` and purge now write permanent tombstones and re-importing the same source reports `ignored`; use `/unignore` to lift.
- Archived sessions are no longer treated as re-importable: archiving writes an `archived` tombstone (unarchiving clears it), replacing the previous "mint a suffixed copy" behavior.



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
