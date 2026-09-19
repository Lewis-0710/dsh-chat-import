# Roadmap

> dsh-chat-import 的需求总览与路线图。状态标记：✅ 已完成 · ◐ 部分完成 · ☐ 未完成 · ❌ 明确不做（附理由）。
> 实现细节与历史见 [CHANGELOG.md](CHANGELOG.md) 与 git 历史。

## 需求总览

| ID | 优先级 | 标题 | 状态 |
| --- | --- | --- | --- |
| REQ-01 | P0 | 重生成干净 lockfile + CI 改 `npm ci` + 防漂移检查 | ✅ |
| REQ-02 | P0 | 收口版本漂移：bump 0.2.0 发布（含 Reasonix/opencode） | ✅ |
| REQ-03 | P1 | 标签纪律：统一 `npm version` bump + tag 流程 | ✅ |
| REQ-04 | P1 | 引入 CHANGELOG | ✅ |
| REQ-05 | P1 | CI 增加 headless 真实加载冒烟 | ✅ |
| REQ-06 | P1 | CI 检查双语 README 同步 | ✅ |
| REQ-07 | P1 | peer 版本策略与兼容矩阵 | ✅ |
| REQ-08 | P2 | `index.mjs` 按职责拆分 | ✅ |
| REQ-09 | P2 | `makeImportChatTool` 参数收敛（18 源 → 单分发器） | ✅ c56a4bf + 2c77b26 |
| REQ-10 | P2 | 引入 eslint + CI 检查 | ✅ |
| REQ-11 | P2 | 修正 dev 文档过时信息 | ✅ |
| REQ-12 | P3 | package.json 元数据补齐 + engines 精确化 | ✅ |
| REQ-13 | P3 | CI 覆盖报告（line ≥ 75% 护栏） | ✅ |
| REQ-14 | P1 | 多源：Kimi CLI 适配（`import_kimi`，第 13 源） | ✅ |
| REQ-15 | P1 | 多源：ZCode 格式侦察 | ✅ 并入 REQ-38 |
| REQ-16 | P1 | 互转：反向导出 MVP — DSH → Claude Code JSONL（`export_claude`） | ✅ |
| REQ-17 | P1 | 保真度：导入 dry-run 预览 | ✅ |
| REQ-18 | P2 | 互转：IR 协议化（interchange v1 schema + 文档） | ✅ 5fe466a |
| REQ-19 | P2 | 保真度：ChatGPT 分支还原 + tool 参数结构化 | ✅ ce90209 |
| REQ-20 | P2 | 保真度：Cursor tool_result / opencode patch diff 复查 | ✅ 边界确认 |
| REQ-21 | P2 | 互转：保真度降级策略显式化 | ✅ acef196 |
| REQ-22 | P3 | 保真度：Reasonix V2 WAL 合并 + Claude compacted 摘要选项 | ✅ 508ef2d |
| REQ-23 | P3 | 互转：矩阵化互转 + repair 校验工具 | ✅ 1f0d9e6 |
| REQ-24 | P0 | 增量续写（重导 append 新轮次 + 源路径幂等键 + force 副本 + sourceShrunk） | ✅ |
| REQ-25 | P1 | 自动发现 + 扫描缓存（scan_discover） | ✅ |
| REQ-26 | P1 | 畸形行行号 + secrets 位置上报 + permission 计数 | ✅ |
| REQ-27 | P1 | 标题兜底（custom-title > ai-title > 首问） | ✅ |
| REQ-28 | P2 | memory / skills / CLAUDE.md 上下文桥接（默认关闭） | ✅ |
| REQ-29 | P2 | /import-all 批量命令（Web 面板 REQ-41、/import REQ-42 已落地） | ✅ c53bc4c |
| REQ-30 | P2 | 交接摘要续聊（/resume-claude /resume-codex） | ✅ cee6153 |
| REQ-31 | P3 | 同类生态插件 / 官方能力监控（周期性） | ✅ |
| REQ-32 | P1 | 内部标记：`session/imported` 事件 | ✅ |
| REQ-33 | P2 | 导入识别 / 撤回（`list_imported_sessions` + 引导手动删） | ✅ |
| REQ-34 | P2 | UI 分组：host-only Web 面板 | ✅ 由 REQ-41 Browser 面板取代 |
| REQ-35 | P2 | 卸载语义（自动撤 Hook、绝不删会话；手动清理引导） | ✅ |
| REQ-36 | P1 | 反向同步：双向同步桥 B 第一步（`sync_to_claude` 增量写回） | ✅ 真实 `claude --resume` 验证待补 |
| REQ-37 | P1 | 超长会话三层保护 + 预算自适应 | ✅ |
| REQ-38 | P1 | ZCode 源适配 | ✅ |
| REQ-39 | P2 | cwd 权威映射 + 沙箱防护 | ✅ 165f7ca（lite 5fab50a + full 同链） |
| REQ-40 | P2 | 发现索引补充（标题/项目/消息数 + 扫描缓存 + 搜索） | ✅ |
| REQ-41 | P2 | Browser 侧侧边栏入口（导入面板） | ✅ |
| REQ-42 | P2 | `/import <tool> <path>` 命令面 | ✅ |
| REQ-43 | P2 | 导入会话工具完整可用（agentPresets.mount + 默认模型绑定） | ✅ 6a518ed |
| REQ-44 | P2 | codex `custom_tool_call` JS 参数转标准 JSON | ✅ |
| REQ-45 | P3 | 源覆盖面：Reasonix 桌面版 + Claude-3p 新端 | ✅ 4e2f193 |
| REQ-46 | P1 | 新源：Grok Build 适配（第 9 源） | ✅ |
| REQ-47 | P1 | 新源：OpenClaw 适配（第 10 源） | ✅ |
| REQ-48 | P1 | 新源：Hermes 适配（第 11 源） | ✅ |
| REQ-49 | P1 | 缺陷：trimTurns L2 锚点收缩静默丢轮 | ✅ |
| REQ-50 | P2 | Hermes-agent（NousResearch）变体 tool_calls / reasoning 独立列 | ✅ |
| REQ-51 | P3 | Hermes 会话 lineage（parent_session_id 压缩分叉） | ✅ 85d85de |
| REQ-52 | P2 | Codex 官方 App Server API 路线侦察 | ✅ 维持 rollout |
| REQ-53 | P2 | 新会话开始迁移提示（per-project 记忆） | ✅ |
| REQ-54 | P2 | 源文件变更自动增量续写 + 面板 Sync 入口 + watch 懒检查 | ✅ |
| REQ-55 | P1 | 缺陷：导入会话归档后可重新导入 | ✅ |
| REQ-56 | P2 | DSH 会话通用导出/备份（interchange bundle + 指纹 + 还原） | ✅ 6ec5818 |
| REQ-57 | P3 | 导入结果结构校验 | ✅ |
| REQ-58 | P3 | scan_discover 索引补 git 分支/dirty | ✅ |
| REQ-59 | P2 | 外部 agent/mode prompt 落盘转换为 DSH skills 资产（`import_agents`） | ✅ |
| REQ-60 | P1 | 发布规范持续达标（plugin_check 全项：types/cordis peer/tsconfig/build 脚本） | ✅ v0.4.0 |
| REQ-61 | P2 | Claude 资产持久化导入（memory / CLAUDE.md / skills → DSH 资产，扩展 import_agents） | ✅ |
| REQ-62 | P2 | 便携 bundle 跨机器移动用例（对标 codex-claude-transfer） | ✅ 6ec5818 |
| REQ-63 | P3 | 仓库社区健康（CONTRIBUTING + issue/PR 模板） | ✅ |
| REQ-64 | P1 | 新源：Continue 适配（`~/.continue/sessions/<id>.json` + `sessions.json` 索引；VS Code / JetBrains / CLI 共用） | ✅ |
| REQ-65 | P1 | 新源：Cline 适配（`~/.cline/data/sessions/<id>/<id>.messages.json` + `db/sessions.db` 元数据索引，DB 优先 / manifest 兜底） | ✅ |
| REQ-66 | P2 | Cline legacy `tasks/` 适配（VS Code globalStorage 的 `api_conversation_history.json` + `ui_messages.json` + `taskHistory.json` 索引；新版 SDK 存储尚未迁移它） | ✅ |
| REQ-67 | P1 | 新源：Goose 适配（`sessions.db` 两表 + `$GOOSE_PATH_ROOT`/三平台路径；旧 jsonl 不读以免重复导入） | ✅ |
| REQ-68 | P2 | 缺陷：数据库类批量来源（opencode / mimocode / kilocode / zcode）的会话标题未钉「来源 · 话题」，DSH 可能回退成工作区目录名 | ✅ |
| REQ-69 | P1 | 新源：Zed Agent 线程适配（`threads.db` 单表 + zstd blob，含 legacy 方言；子代理线程不单独成会话） | ✅ |
| REQ-70 | P1 | 新源：Crush（Charm）适配（项目内 `crush.db` + `projects.json` 注册表 / 宿主工作区探测；parts wrapper 形状） | ✅ |
| REQ-71 | P2 | 测试稳定性：Windows 上偶发单点失败（`EPERM: rename` 原子写、临时目录竞争、`rm` 语义相关用例）——给用例独立 tmp 根并隔离文件锁依赖 | ☐ |
| REQ-75 | P1 | 缺陷：Codex 新版 CLI 分页 rollout（一个会话拆成多个 `rollout-*.jsonl`）被当成多条同名会话——按 thread id 成链后整链一次导入（issue #57） | ✅ |
| REQ-76 | P1 | 缺陷：Kimi Code 导入丢失工作区（state.json 字段变更为 workDir）与下划线 sessionId 清理校验放宽（issue #61） | ✅ |
| REQ-77 | P2 | Kimi Code：`state.json` 整份缺失时按 `~/.kimi-code/workspaces.json`（workspace-id → root）回退解析 cwd（与旧布局的 `kimi.json` 映射对称） | ✅ |
| REQ-78 | P2 | 文档：写明 Kimi `context.apply_compaction` 的压缩语义（只保留最后一次压缩之后的模型视角，轮数会少于 `turn.prompt` 条数）——README 与 `import_chat` 描述 | ☐ |
| REQ-79 | P2 | 反向导出：新增 opencode 目标（`opencode import <file>` 接受的 JSON——session + messages + parts 三表形状） | ✅ |
| REQ-80 | P1 | 面板「导入到」下拉：直投 Claude Code / Codex / Kimi Code / opencode（转投到目标格式落盘，DSH 侧不留中间会话） | ✅ |
| REQ-81 | P1 | 新源：TeleAgent（星辰超级智能体）适配——opencode 同构三表库 + `users/<账户>/teleagent.db` 多账户目录发现（issue #60） | ✅ |
| REQ-82 | P0 | 缺陷：ChatGPT 官方导出被静默丢弃——`children` 缺失（slim 导出）/ 占位 root 无 message / 带小数秒未取整致宿主拒收整份会话（issue #62） | ✅ |
| REQ-83 | P2 | 清理入口不对称：`purge*` 只挂在面板路由上，工具面仅有 `retract_import`（清 registry 记录、不做删除），Agent 无自助回滚手段（issue #62 的观察项） | ❌ 不做：删除是低频需求，而常驻工具描述会挤占上下文、拉低日常体验；面板 History 页已提供带确认的批量删除 |
| REQ-84 | P1 | 「导入会话」窗口接入官方原生右侧栏 tab（DSH ≥ 0.1.5-rc.1 的 `sidebarRightTabs` / `sidebar.right.pane.tab`，参照 dsh-context；footer 按钮打开同一 tab、对话区保留）——dsh peer 抬到 ≥ 0.1.5-rc.1 后删除 better-sidebar 集成与自绘 ShellPanel 浮层回落链（REQ-41 的浮层形态退役，按钮保留） | ✅ |


