# AI Agent (Docker + FHIR)

This project runs an interactive AI agent that can call tools (including FHIR tools) to query and summarize clinical data from a FHIR repository.

## 1) Build and Run with Docker

### Prerequisite: your own OpenAI API key

For the workshop, each participant must use their own OpenAI API key.

1. Purchase/create your OpenAI API key in your own OpenAI account.
2. In the project root, copy the example file:

```bash
cp .env.example .env
```

3. Open `.env`.
4. Set the key using this exact variable name:

```env
OPENAI_API_KEY=your_actual_openai_api_key_here
```

Important:
- Keep the variable name exactly `OPENAI_API_KEY` (uppercase, with underscores).
- Do not wrap the key in quotes.
- Do not commit your personal key to git or share it publicly.

### Build the image

From the project root:

```bash
docker compose build
```

### Start the agent (interactive prompt)

Use this command to get the same interactive experience as `uv run main.py`:

```bash
docker compose run --rm ai-agent
```

You should see the AI Agent banner and then the prompt:

```text
>
```

### Stop the agent

- If you started it with `docker compose run --rm ai-agent`, press:
  - `Ctrl+C` to stop the session
  - container is automatically removed because of `--rm`
- If you ever start services with `docker compose up` / `docker compose up -d`, stop them with:

```bash
docker compose down
```

## 2) Using Slash Commands and Querying FHIR

Once the agent is running, type normal prompts (for example, "How many patients have type 2 diabetes?") or use slash commands.

### `/config`

Shows the active runtime configuration, including:
- model name
- working directory
- approval mode
- whether hooks are enabled
- FHIR base URL/schema

Use this to quickly verify the agent is pointing at the expected FHIR endpoint.

### `/tools`

Lists available tools registered in the session (for example, `fhir_search`, `fhir_read`, `fhir_everything`, web tools, filesystem tools, etc.).

Use this to confirm FHIR and MCP-backed tools are loaded and available.

### `/mcp`

Shows configured MCP servers and whether each one is connected.

Use this to verify external capability providers are online before running advanced requests.

### Why this is useful for FHIR

This setup makes FHIR exploration much easier because you can ask clinical questions in natural language and let the agent:
- map intent to FHIR operations
- call FHIR tools (`fhir_search`, `fhir_read`, `fhir_everything`)
- summarize results into concise clinical answers

Example prompts:
- "How many patients have type 2 diabetes?"
- "Show heart rate observations for Patient/45878."
- "Create a clinical summary for Patient/4."

## Troubleshooting (Quick)

- **No prompt appears**
  - Use `docker compose run --rm ai-agent` (interactive).
  - `docker compose up` is for service logs/lifecycle and may not behave like a CLI session.

- **FHIR connection fails**
  - Run `/config` and verify `Base FHIR URL`.
  - Confirm the FHIR container is running and publishing host port `8080`.
  - In this setup, the agent reaches FHIR via `host.docker.internal`.

- **MCP server looks disconnected**
  - Run `/mcp` to inspect status.
  - Ensure required MCP runtime dependencies are available in the container (for example `npx` for Node-based MCP servers, if used).
