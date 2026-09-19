<div align="center">

<img src="./assets/dci-promo.png" alt="DSH Chat Import 宣传图" width="100%" />

# DSH Chat Import

**基于 DeepSeek Harness 构建的会话导入插件，一键导入外部 Agents 的聊天历史并在 DeepSeek Harness 中继续对话。**

> **所有会话，尽续于此。**

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red.svg)](README.zh-CN.md)

[![version](https://img.shields.io/npm/v/dsh-chat-import?style=flat&label=version&color=4D6BFE)](https://www.npmjs.com/package/dsh-chat-import)
[![downloads](https://img.shields.io/npm/dm/dsh-chat-import?style=flat&label=downloads&color=4D6BFE)](https://www.npmjs.com/package/dsh-chat-import)
[![GitHub stars](https://img.shields.io/github/stars/Nwflower/dsh-chat-import?style=flat&label=%E2%98%85&color=08C)](https://github.com/Nwflower/dsh-chat-import)
[![GitCode](https://img.shields.io/badge/GitCode-%E9%95%9C%E5%83%8F-4D6BFE?style=flat)](https://gitcode.com/Nwflower/dsh-chat-import)
[![license](https://img.shields.io/badge/license-MIT-2EA44F?style=flat)](LICENSE)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![dsh.so install](https://www.dsh.so/badge/install/dsh-chat-import.svg)](https://www.dsh.so/artifact/dsh-chat-import/)

</div>


## 简介

`DSH Chat Import` 从其他 Agents 导入含完整上下文的聊天历史，成为可无缝继续的 DeepSeek Harness 会话。

现已覆盖 **27 种格式**（25 种外部 Agent + DSH + 本地 JSONL）——完整列表见[支持的 Agents](#支持的-agents)。反向导出：Claude Code、Codex、Kimi Code、opencode。


## 支持的 Agents

下表的每个来源都会导入为独立 DSH 会话，工具调用、工具结果与推理原样保留。

**终端 Agents**

<table>
  <tr>
    <td align="center" width="20%"><a href="https://github.com/anthropics/claude-code"><img src="./assets/agents/claude.svg" width="56" height="56" alt="Claude Code" /><br /><b>Claude Code</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/openai/codex"><img src="./assets/agents/codex.svg" width="56" height="56" alt="Codex" /><br /><b>Codex</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/google-gemini/gemini-cli"><img src="./assets/agents/gemini.svg" width="56" height="56" alt="Gemini CLI" /><br /><b>Gemini CLI</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/aaif-goose/goose"><img src="./assets/agents/goose.svg" width="56" height="56" alt="Goose" /><br /><b>Goose</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/charmbracelet/crush"><img src="./assets/agents/crush.svg" width="56" height="56" alt="Crush" /><br /><b>Crush</b></a></td>
  </tr>
  <tr>
    <td align="center" width="20%"><a href="https://github.com/qoderAI/qoder-cli"><img src="./assets/agents/qoder.svg" width="56" height="56" alt="Qoder CLI" /><br /><b>Qoder CLI</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/MoonshotAI/kimi-cli"><img src="./assets/agents/kimi.svg" width="56" height="56" alt="Kimi CLI" /><br /><b>Kimi CLI</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/MoonshotAI/kimi-code"><img src="./assets/agents/kimi.svg" width="56" height="56" alt="Kimi Code" /><br /><b>Kimi Code</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/esengine/DeepSeek-Reasonix"><img src="./assets/agents/reasonix.svg" width="56" height="56" alt="Reasonix" /><br /><b>Reasonix</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/anomalyco/opencode"><img src="./assets/agents/opencode.svg" width="56" height="56" alt="OpenCode" /><br /><b>OpenCode</b></a></td>
  </tr>
  <tr>
    <td align="center" width="20%"><a href="https://github.com/XiaomiMiMo/MiMo-Code"><img src="./assets/agents/mimocode.svg" width="56" height="56" alt="MiMo Code" /><br /><b>MiMo Code</b></a></td>
    <td align="center" width="20%"><a href="https://z.ai"><img src="./assets/agents/zcode.svg" width="56" height="56" alt="ZCode" /><br /><b>ZCode</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/xai-org/grok-build"><img src="./assets/agents/grokbuild.svg" width="56" height="56" alt="Grok Build" /><br /><b>Grok Build</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/openclaw/openclaw"><img src="./assets/agents/openclaw.svg" width="56" height="56" alt="OpenClaw" /><br /><b>OpenClaw</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/Kilo-Org/kilocode"><img src="./assets/agents/kilocode.svg" width="56" height="56" alt="Kilo Code" /><br /><b>Kilo Code</b></a></td>
  </tr>
  <tr>
    <td align="center" width="20%"><a href="https://github.com/badlogic/pi-mono"><img src="./assets/agents/pi.svg" width="56" height="56" alt="Pi Coding Agent" /><br /><b>Pi Coding Agent</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/NousResearch/hermes-agent"><img src="./assets/agents/hermes.svg" width="56" height="56" alt="Hermes" /><br /><b>Hermes</b></a></td>
    <td align="center" width="20%"></td>
    <td align="center" width="20%"></td>
    <td align="center" width="20%"></td>
  </tr>
</table>

**IDE / 编辑器 Agents**

<table>
  <tr>
    <td align="center" width="20%"><a href="https://cursor.com"><img src="./assets/agents/cursor.svg" width="56" height="56" alt="Cursor" /><br /><b>Cursor</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/cline/cline"><img src="./assets/agents/cline.svg" width="56" height="56" alt="Cline" /><br /><b>Cline</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/continuedev/continue"><img src="./assets/agents/continue.svg" width="56" height="56" alt="Continue" /><br /><b>Continue</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/zed-industries/zed"><img src="./assets/agents/zed.svg" width="56" height="56" alt="Zed" /><br /><b>Zed</b></a></td>
    <td align="center" width="20%"><a href="https://antigravity.google"><img src="./assets/agents/antigravity.svg" width="56" height="56" alt="Antigravity CLI" /><br /><b>Antigravity CLI</b></a></td>
  </tr>
</table>

**聊天 / 办公工具 / 本体**

<table>
  <tr>
    <td align="center" width="20%"><a href="https://chatgpt.com"><img src="./assets/agents/chatgpt.svg" width="56" height="56" alt="ChatGPT" /><br /><b>ChatGPT</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/gabotechs/workbuddy"><img src="./assets/agents/workbuddy.svg" width="56" height="56" alt="WorkBuddy" /><br /><b>WorkBuddy</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/QwenLM/qwen-code"><img src="./assets/agents/qwen.svg" width="56" height="56" alt="千问办公" /><br /><b>千问办公</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/deepseek-ai/deepseek-harness"><img src="./assets/agents/dsh.svg" width="56" height="56" alt="DSH" /><br /><b>DSH</b></a></td>
    <td align="center" width="20%"><a href="https://www.teleai.com.cn/product/super-agent"><img src="./assets/agents/teleagent.svg" width="56" height="56" alt="TeleAgent" /><br /><b>TeleAgent</b></a></td>
    <td align="center" width="20%"><a href="#使用"><img src="./assets/agents/local-jsonl.svg" width="56" height="56" alt="本地 JSONL" /><br /><b>本地 JSONL</b></a></td>
  </tr>
</table>


## 安装

```bash
dsh plugin --profile web add dsh-chat-import                    # npm 包
dsh plugin --profile web add -w link:/path/to/dsh-chat-import   # 本地源码（符号链接）
```

> **需要 dsh ≥ 0.1.5-rc.1** —— 导入窗口停靠进官方原生**右侧栏**（`@deepseek-ai/dsh-client-ui-sidebar-right`），版本门槛见 `peerDependencies`。

## 使用

1. **导入** — 从左侧栏底部的「导入会话」按钮打开导入窗口，窗口**停靠进官方原生右侧栏**（tab 在右栏内展开、对话区保留）。选择你想导入的会话并一键导入。或让你的 Agent 调用上下文工具进行导入：

```
import_chat({ format: "claude", path: "~/.claude/projects" })
import_chat({ format: "chatgpt", path: "~/Downloads/chatgpt-export/conversations.json" })
import_chat({ format: "local-jsonl", path: "D:\downloads\session.jsonl" })
```

Reasonix 目录导入只会折叠同时满足“严格语义前缀”和明确 `parent_id` 谱系证明的恢复祖先。无法证明或真实分叉的文件继续独立保留；`lineageMode: "physical"` 可恢复每个 JSONL 一条会话。

2. **续聊** — 刷新会话列表，打开导入的会话，从源记录停下的地方继续对话。

3. **同步（可选）** — 面板「同步」页提供双向增量同步，默认关闭。子代理对话默认双向过滤。

4. **工具注入档位（可选）** — 设置页「会话导入」分区可调 `injectTools` 三档：**精简**（默认，只常驻 `import_chat` 入口工具，低频管理型工具不占上下文）、**全量**（注入全部 13 个工具）、**关闭**（Agent 不可见，仅 GUI 面板可转换）。工具描述已按「选择时最小化」瘦身，行为细节由执行结果与错误文本按需携带。

完整工具 / 命令用法（参数、示例、边界行为）见 **[docs/USAGE.zh-CN.md](docs/USAGE.zh-CN.md)**。

## 配套工具：配置迁移

只想迁移**配置**（技能、hooks、全局设置等）而不需要会话历史？[dsh-movein](https://github.com/sjh9714/dsh-movein) 负责配置迁移，与本插件分工互补--本插件只管会话历史，两边可按需单独使用。其[首次迁移指南](https://github.com/sjh9714/dsh-movein/blob/main/docs/first-migration.zh.md)提供「先预演、后应用、逐步验证」的分步流程。

> 两个工具的组合流程尚未联合验证，互链不构成互相背书；请分别检查来源、目标、重复导入与撤回边界。

本插件的 `import_agents` 是轻量的资产搬移（把 pi/opencode/Claude/Codex 的 agent、prompt、skill 落盘为 DSH skills）；需要 hooks、权限规则、settings 等完整配置迁移时，请使用 dsh-movein。

## 功能一览

| 能力 | 入口 | 说明 |
| --- | --- | --- |
| 批量导入 | `import_chat`（27 种格式）· `scan_discover` · 侧边栏面板 | 27 种格式一键导入，每段对话成为独立会话 |
| Cline 旧版任务 | `import_chat({ format: "cline" })` · `scan_discover` | 读取 VS Code globalStorage 中的旧版任务（`state/taskHistory.json` 与 `tasks/<id>/api_conversation_history.json`）；非标准配置可设置 `CLINE_LEGACY_GLOBAL_STORAGE_DIR` |
| 导入历史与撤回 | 侧边栏面板「历史」页 | 展示 `imports.json` 记录；一键删除本插件创建的会话（需确认） |
| 全保真续聊 | 导入即 DSH 会话 | 工具调用/结果、思考、标题、模型、时间戳原样保留 |
| 反向导出 | `export_chat`（`format: claude` / `codex` / `kimi` / `opencode`） | DSH 会话序列化回 Claude / Codex / Kimi / opencode（opencode 的 JSON 交给 `opencode import` 导入） |
| 双向同步 | 面板「同步」页 | 外部 ↔ DSH 双向增量同步，默认关闭 |

> 「全保真」的既定例外：源转录里**失败重发的 ghost step**（一轮工具调用没等到结果而中止、紧随的下一步用同一 callId 原样重发）会在导入时去重——保留重发步、丢弃失败步。重复 callId 的 `tool/call` 会让 DSH 会话折叠器在「同一 id 第二次 start」处硬异常、吞掉其后整段轨迹。丢弃计数见转换返回值 `droppedRetrySteps`。

## 文档

| 文档 | 说明 |
| --- | --- |
| [使用详解](docs/USAGE.zh-CN.md) | 每个工具 / 命令的完整参数、示例与边界行为 |
| [互转协议](docs/INTERCHANGE.md) | Interchange v1 协议与 bundle 格式 |
| [更新日志](CHANGELOG.md) | 版本历史（英文） |
| [路线图](ROADMAP.md) | 已实现 / 规划 |
| [贡献指南](CONTRIBUTING.md) | 开发环境、提交规范、安全与隐私 |

## Star History

[![Star History Chart](https://api.star-history.com/chart?repos=Nwflower/dsh-chat-import&type=date&legend=top-left&sealed_token=sAq09Z4DmwD843pzhg7azZtfXs8zW_Xij3fvCo3Ns1BGAgNeP_Zl1xU9YiUacS74_EzDXKHFpW3Bfj13ClcEMRzAhh4mVrl4a20ijURAGU_Oz6RROQYDYw)](https://www.star-history.com/?type=date&repos=Nwflower%2Fdsh-chat-import)
