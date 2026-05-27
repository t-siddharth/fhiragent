# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an interactive AI agent CLI that uses OpenAI models to query and summarize clinical data from a FHIR repository. It supports tool use (filesystem, FHIR, web, MCP-based terminology lookups), session persistence, hooks, and context management with automatic compression.

## Running the Agent

```bash
# Local (requires Python 3.11+, uses uv)
uv run main.py              # interactive mode
uv run main.py "prompt"     # single-shot mode
uv run main.py --cwd /path  # specify working directory

# Docker
docker compose build
docker compose run --rm ai-agent
```

## Linting / Formatting

```bash
uv run black .
```

## Environment Variables

- `API_KEY` — OpenAI API key (previously `OPENAI_API_KEY` in `.env`)
- `BASE_URL` — optional custom OpenAI-compatible base URL
- `BASE_FHIR_ADDRESS` / `BASE_FHIR_PATH` — override FHIR endpoint from env (used in Docker)

## Architecture

### Core Loop

`main.py` → `CLI` (interactive REPL with slash commands) → `Agent` → agentic loop that streams LLM responses and executes tool calls until no more tool calls are returned or max turns reached.

### Key Modules

- **`agent/`** — `Agent` (agentic loop with streaming events), `Session` (owns all per-session state: client, tools, context, hooks, loop detection), `events.py` (event types emitted during agent run)
- **`client/`** — `LLMClient` wraps the OpenAI SDK; `response.py` defines streaming event types and `TokenUsage`/`ToolCall` dataclasses
- **`config/`** — `Config` (Pydantic model), `loader.py` (merges system config from `~/.config/ai-agent/config.toml` with project config from `.ai-agent/config.toml`; also reads `AGENT.MD` as developer instructions)
- **`context/`** — `ContextManager` (message history, token counting, pruning old tool outputs), `ChatCompactor` (summarizes conversation when approaching context limit), `LoopDetector`
- **`tools/`** — Tool system built on `tools/base.py` (`Tool` abstract class, `ToolResult`, `ToolKind` enum). Builtin tools in `tools/builtin/`. MCP tools in `tools/mcp/`. Subagents in `tools/subagents.py`.
- **`tools/builtin/registry.py`** — `ToolRegistry` manages tool registration and invocation with approval checks and hooks
- **`prompts/system.py`** — Constructs the system prompt with identity, FHIR rules, tool guidelines, memory, and developer/user instructions
- **`hooks/`** — `HookSystem` triggers shell commands on before/after agent and tool events
- **`safety/`** — `ApprovalManager` implements approval policies (auto, on-request, yolo, etc.)
- **`ui/tui.py`** — Rich-based TUI for streaming output and tool call display
- **`clinical/`** — FHIR bundle processing utilities
- **`utils/codes/`** — SNOMED, LOINC, RxNorm helpers

### Configuration Hierarchy

1. System config: `~/.config/ai-agent/config.toml`
2. Project config: `.ai-agent/config.toml` (overrides system)
3. Environment variables override FHIR base URL
4. `AGENT.MD` in project root → injected as `developer_instructions` in system prompt

### Tool System

Tools extend `Tool` base class and implement `execute(ToolInvocation) -> ToolResult`. Each tool has a `ToolKind` (read/write/shell/network/memory/mcp). The `allowed_tools` list in config.toml restricts which tools are available.

MCP servers are configured in `config.toml` under `[mcp_servers.*]` and support stdio or HTTP/SSE transport. Tools from MCP servers are registered into the same `ToolRegistry`.

### FHIR Integration

The agent uses reverse-chaining (`_has`) queries to find patients by condition/medication/observation. Clinical terms are resolved to standard codes via MCP terminology servers (SNOMED, LOINC, RxNorm) before querying FHIR. The FHIR endpoint is configured in `config.toml` under `[fhir]`.

## Slash Commands (Interactive Mode)

`/help`, `/config`, `/tools`, `/mcp`, `/model <name>`, `/approval <policy>`, `/stats`, `/clear`, `/save`, `/resume <id>`, `/sessions`, `/checkpoint`, `/restore <id>`, `/exit`
