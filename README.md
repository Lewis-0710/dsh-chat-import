<div align="center">

<img src="./assets/dci-promo.png" alt="DSH Chat Import" width="100%" />

# DSH Chat Import

**A DeepSeek Harness plugin that imports conversation history from 18+ AI coding tools, so you can continue right where you left off.**

> **All sessions, continued in DSH.**

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red.svg)](README.zh-CN.md)

[![version](https://img.shields.io/npm/v/dsh-chat-import?style=flat&label=version&color=4D6BFE)](https://www.npmjs.com/package/dsh-chat-import)
[![downloads](https://img.shields.io/npm/dm/dsh-chat-import?style=flat&label=downloads&color=4D6BFE)](https://www.npmjs.com/package/dsh-chat-import)
[![GitHub stars](https://img.shields.io/github/stars/Nwflower/dsh-chat-import?style=flat&label=%E2%98%85&color=08C)](https://github.com/Nwflower/dsh-chat-import)
[![GitCode](https://img.shields.io/badge/GitCode-mirror-4D6BFE?style=flat)](https://gitcode.com/Nwflower/dsh-chat-import)
[![license](https://img.shields.io/badge/license-MIT-2EA44F?style=flat)](LICENSE)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![dsh.so install](https://www.dsh.so/badge/install/dsh-chat-import.svg)](https://www.dsh.so/artifact/dsh-chat-import/)

</div>

## Intro

`DSH Chat Import` imports conversation history with full context from other agents, turning it into a seamlessly resumable DeepSeek Harness session.

**25 agents** plus any local JSONL are covered today — the full list is under [Supported Agents](#supported-agents). Export back to: Claude Code, Codex, Kimi Code.

## Supported Agents

Every source below becomes an independent DSH session, with tool calls, tool results and reasoning kept intact.

**Terminal agents**

<table>
  <tr>
    <td align="center" width="25%"><a href="https://github.com/anthropics/claude-code"><img src="./assets/agents/claude.svg" width="56" height="56" alt="Claude Code" /><br /><b>Claude Code</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/openai/codex"><img src="./assets/agents/codex.svg" width="56" height="56" alt="Codex" /><br /><b>Codex</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/google-gemini/gemini-cli"><img src="./assets/agents/gemini.svg" width="56" height="56" alt="Gemini CLI" /><br /><b>Gemini CLI</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/aaif-goose/goose"><img src="./assets/agents/goose.svg" width="56" height="56" alt="Goose" /><br /><b>Goose</b></a></td>
  </tr>
  <tr>
    <td align="center" width="25%"><a href="https://github.com/qoderAI/qoder-cli"><img src="./assets/agents/qoder.svg" width="56" height="56" alt="Qoder CLI" /><br /><b>Qoder CLI</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/MoonshotAI/kimi-cli"><img src="./assets/agents/kimi.svg" width="56" height="56" alt="Kimi CLI" /><br /><b>Kimi CLI</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/MoonshotAI/kimi-code"><img src="./assets/agents/kimi.svg" width="56" height="56" alt="Kimi Code" /><br /><b>Kimi Code</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/esengine/DeepSeek-Reasonix"><img src="./assets/agents/reasonix.svg" width="56" height="56" alt="Reasonix" /><br /><b>Reasonix</b></a></td>
  </tr>
  <tr>
    <td align="center" width="25%"><a href="https://github.com/anomalyco/opencode"><img src="./assets/agents/opencode.svg" width="56" height="56" alt="OpenCode" /><br /><b>OpenCode</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/XiaomiMiMo/MiMo-Code"><img src="./assets/agents/mimocode.svg" width="56" height="56" alt="MiMo Code" /><br /><b>MiMo Code</b></a></td>
    <td align="center" width="25%"><a href="https://z.ai"><img src="./assets/agents/zcode.svg" width="56" height="56" alt="ZCode" /><br /><b>ZCode</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/xai-org/grok-build"><img src="./assets/agents/grokbuild.svg" width="56" height="56" alt="Grok Build" /><br /><b>Grok Build</b></a></td>
  </tr>
  <tr>
    <td align="center" width="25%"><a href="https://github.com/openclaw/openclaw"><img src="./assets/agents/openclaw.svg" width="56" height="56" alt="OpenClaw" /><br /><b>OpenClaw</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/Kilo-Org/kilocode"><img src="./assets/agents/kilocode.svg" width="56" height="56" alt="Kilo Code" /><br /><b>Kilo Code</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/badlogic/pi-mono"><img src="./assets/agents/pi.svg" width="56" height="56" alt="Pi Coding Agent" /><br /><b>Pi Coding Agent</b></a></td>
    <td align="center" width="25%"><a href="https://github.com/NousResearch/hermes-agent"><img src="./assets/agents/hermes.svg" width="56" height="56" alt="Hermes" /><br /><b>Hermes</b></a></td>
  </tr>
</table>

**IDE & editor agents**

<table>
  <tr>
    <td align="center" width="20%"><a href="https://cursor.com"><img src="./assets/agents/cursor.svg" width="56" height="56" alt="Cursor" /><br /><b>Cursor</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/cline/cline"><img src="./assets/agents/cline.svg" width="56" height="56" alt="Cline" /><br /><b>Cline</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/continuedev/continue"><img src="./assets/agents/continue.svg" width="56" height="56" alt="Continue" /><br /><b>Continue</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/zed-industries/zed"><img src="./assets/agents/zed.svg" width="56" height="56" alt="Zed" /><br /><b>Zed</b></a></td>
    <td align="center" width="20%"><a href="https://antigravity.google"><img src="./assets/agents/antigravity.svg" width="56" height="56" alt="Antigravity CLI" /><br /><b>Antigravity CLI</b></a></td>
  </tr>
</table>

**Chat, office tools & harness**

<table>
  <tr>
    <td align="center" width="20%"><a href="https://chatgpt.com"><img src="./assets/agents/chatgpt.svg" width="56" height="56" alt="ChatGPT" /><br /><b>ChatGPT</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/gabotechs/workbuddy"><img src="./assets/agents/workbuddy.svg" width="56" height="56" alt="WorkBuddy" /><br /><b>WorkBuddy</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/QwenLM/qwen-code"><img src="./assets/agents/qwen.svg" width="56" height="56" alt="Qwen Work CN" /><br /><b>Qwen Work CN</b></a></td>
    <td align="center" width="20%"><a href="https://github.com/deepseek-ai/deepseek-harness"><img src="./assets/agents/dsh.svg" width="56" height="56" alt="DSH" /><br /><b>DSH</b></a></td>
    <td align="center" width="20%"><a href="#usage"><img src="./assets/agents/local-jsonl.svg" width="56" height="56" alt="Local JSONL" /><br /><b>Local JSONL</b></a></td>
  </tr>
</table>

## Install

```bash
dsh plugin --profile web add dsh-chat-import                    # npm package
dsh plugin --profile web add -w link:/path/to/dsh-chat-import   # local checkout (symlink)
```

## Usage

1. **Import** — pick the conversations to import from the "Import sessions" panel in the bottom-right of the GUI and import with one click, or have your agent call the context tool:

```
import_chat({ format: "claude", path: "~/.claude/projects" })
import_chat({ format: "chatgpt", path: "~/Downloads/chatgpt-export/conversations.json" })
import_chat({ format: "local-jsonl", path: "D:\downloads\session.jsonl" })
```

Reasonix directory imports conservatively collapse only recovery ancestors proven by both a strict semantic prefix and an explicit `parent_id` lineage. Ambiguous or divergent files remain separate; use `lineageMode: "physical"` for one session per JSONL.

2. **Resume** — refresh the session list, open the imported session, and keep chatting from where the source left off.

3. **Sync (optional)** — the panel's "Sync" tab offers bidirectional incremental sync, off by default. Sub-agent conversations are filtered out by default in both directions.

4. **Tool injection (optional)** — the "Session Import" settings section exposes three `injectTools` levels: **Minimal** (default, keeps only the `import_chat` entry tool resident; low-frequency management tools stay out of context), **Full** (all 13 tools), and **Off** (invisible to the agent; the GUI panel still works). Tool descriptions are slimmed down to selection-time essentials; behavioral details ride along in execution results and error text, only when needed.

Full tool / command usage (parameters, examples, edge cases) lives in **[docs/USAGE.md](docs/USAGE.md)**.

## Companion tool: config migration

Only need to migrate **configuration** (skills, hooks, global settings) rather than conversation history? [dsh-movein](https://github.com/sjh9714/dsh-movein) handles config migration and complements this plugin -- DSH Chat Import only handles conversation history, and each tool works standalone. Its first-migration guide ([中文](https://github.com/sjh9714/dsh-movein/blob/main/docs/first-migration.zh.md)) walks through a preview-first, apply-second, verify-each-step flow.

> The combined flow of the two tools has not been jointly validated, and cross-linking is not a mutual endorsement; check sources, targets, duplicate-import and retraction boundaries for each tool separately.

This plugin's `import_agents` is a lightweight asset mover (it persists pi/opencode/Claude/Codex agents, prompts and skills as DSH skills); for full config migration (hooks, permission rules, settings), use dsh-movein.

## Features

| Capability | Entry points | Description |
| --- | --- | --- |
| Batch import | `import_chat` (24 formats) · `scan_discover` · sidebar panel | Import 23+ sources with one tool; each conversation becomes its own session |
| Import history & purge | sidebar panel **History** tab | View `imports.json` records; remove plugin-created sessions (with confirmation) |
| Full-fidelity resume | Imported sessions | Tool calls & results, reasoning, titles, models and timestamps carry over |
| Export back | `export_chat` (`format: claude` / `codex` / `kimi`) | Serialize DSH sessions back to Claude / Codex / Kimi |
| Bidirectional sync | panel "Sync" tab | Incremental sync in both directions (external ↔ DSH), off by default |

> One documented exception to full fidelity: **failed ghost retry steps**. When a tool call never received its result and the very next step re-emits the same call id verbatim, the dead step is dropped at import — the result already pairs with the re-emitted call. Duplicate call ids in the imported log would hard-fail DSH's conversation folding (a second `start` for the same id), swallowing the whole trajectory after the first duplicate. See the `droppedRetrySteps` counter on the converter result.

## Docs

| Document | Description |
| --- | --- |
| [Usage Reference](docs/USAGE.md) | Full parameters, examples and edge cases for every tool / command |
| [Interchange protocol](docs/INTERCHANGE.md) | Interchange v1 protocol and bundle format |
| [Changelog](CHANGELOG.md) | Version history |
| [Roadmap](ROADMAP.md) | Shipped / planned |
| [Contributing](CONTRIBUTING.md) | Development setup, commit rules, security & privacy |

## Star History

[![Star History Chart](https://api.star-history.com/chart?repos=Nwflower/dsh-chat-import&type=date&legend=top-left&sealed_token=sAq09Z4DmwD843pzhg7azZtfXs8zW_Xij3fvCo3Ns1BGAgNeP_Zl1xU9YiUacS74_EzDXKHFpW3Bfj13ClcEMRzAhh4mVrl4a20ijURAGU_Oz6RROQYDYw)](https://www.star-history.com/?type=date&repos=Nwflower%2Fdsh-chat-import)
