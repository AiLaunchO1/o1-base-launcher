# o1 Base Launcher

An installable agent skill and local MCP server for Base Mainnet. It can read o1 Launchpad data, prepare Standard token launches and exact-input buys/sells, prepare direct ETH/ERC-20 transfers and creator fee claims, and route transaction approval to a browser wallet. The wallet signs and broadcasts; this server never receives private keys.

**Status:** source release for local evaluation. Build, lint, and offline security tests pass. The build environment could not reach the o1 OpenAPI download, npm registry, Base RPC, or a wallet extension. Live o1 response schemas, wallet approval, and transaction confirmation have not been exercised end to end. See [Current limits](#current-limits) before using mainnet funds.

## Requirements

- Node.js 24 or newer.
- A local EIP-1193 browser wallet with a Base Mainnet EOA account. Smart contract accounts are not supported yet.
- A scoped o1 Launchpad API key from the [o1 developer portal](https://launch.o1.exchange/developers).
- A Base RPC endpoint. The default is `https://mainnet.base.org`; a private provider may be needed for reliability.
- A local agent client that supports both Agent Skills and stdio MCP servers. The browser wallet must run on the same computer as the MCP process.

## Install for any user

Each user installs a local copy and connects **their own** o1 API key and Base wallet. The public repository does not contain anyone's credentials or a shared wallet. The local wallet bridge must run on the same computer as the wallet extension.

With Node.js 24+ and Git installed, run:

```sh
git clone https://github.com/AiLaunchO1/o1-base-launcher.git
cd o1-base-launcher
npm run setup
npm test
```

`npm run setup` builds the MCP server and configures Codex, Claude Code, and Cursor for the current computer user. It copies the skill to their personal skill directories and registers the local MCP server without storing an API key in client config. To configure one client, use `npm run setup -- --client codex`, `claude`, or `cursor`. The script preserves unrelated MCP entries and can be rerun from the same checkout. Start a new client session after setup.

There are no runtime npm dependencies. Copy `.env.example` for a reference, then set `O1_API_KEY` in your own operating system environment or a secret manager before starting the agent client. The server does **not** load `.env` automatically; this avoids reading a key from an unexpected working directory. Do not paste the key into chat, MCP config, or committed files. Set `BASE_RPC_URL` if you use another trusted Base RPC.

The MCP command is `node /absolute/path/to/o1-base-launcher/dist/index.js`. Replace the path with the path on **your own computer**. Restart the client after adding the MCP server. Each client launches its own local process and wallet session.

### Manual client setup

Use these instructions if you prefer to configure a client yourself or it uses a different skill/MCP location. The setup command above handles all three listed clients.

#### Codex

Copy the repository’s `SKILL.md` and `references/` into `~/.agents/skills/o1-base-launcher/` or a project’s `.agents/skills/o1-base-launcher/`. In `~/.codex/config.toml`, add:

```toml
[mcp_servers.o1-base-launcher]
command = "node"
args = ["/absolute/path/to/o1-base-launcher/dist/index.js"]
env_vars = ["O1_API_KEY", "BASE_RPC_URL"]

[mcp_servers.base-docs]
url = "https://docs.base.org/mcp"
```

`base-docs` is optional and provides documentation only. Check the server with `codex mcp list` and start a new chat so the skill and tools are discovered. [Codex MCP setup](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [skill locations](https://learn.chatgpt.com/docs/build-skills).

#### Claude Code

Copy `SKILL.md` and `references/` into `~/.claude/skills/o1-base-launcher/` or the project’s `.claude/skills/o1-base-launcher/`. With `O1_API_KEY` set in the environment where Claude Code starts:

```sh
claude mcp add --scope user o1-base-launcher -- node /absolute/path/to/o1-base-launcher/dist/index.js
claude mcp add --scope user --transport http base-docs https://docs.base.org/mcp
claude mcp list
```

The Base Docs line is optional. Use `/mcp` inside Claude Code to check the local server. [Claude MCP setup](https://code.claude.com/docs/en/mcp), [skill locations](https://code.claude.com/docs/en/skills).

#### Cursor

Copy `SKILL.md` and `references/` into `~/.cursor/skills/o1-base-launcher/` or the project’s `.cursor/skills/o1-base-launcher/`. Add this to Cursor’s `mcp.json` in Settings → Tools & MCP, replacing the absolute path:

```json
{
  "mcpServers": {
    "o1-base-launcher": {
      "command": "node",
      "args": ["/absolute/path/to/o1-base-launcher/dist/index.js"]
    },
    "base-docs": {
      "url": "https://docs.base.org/mcp"
    }
  }
}
```

Set `O1_API_KEY` in Cursor’s parent process environment before starting it. Do not put the key as a literal `env` value in this file. [Cursor MCP setup](https://cursor.com/docs/mcp), [Cursor skills](https://cursor.com/help/customization/skills).

## Use in chat

1. Ask: “Connect my Base wallet for o1.” Open the returned local URL in the browser with your wallet extension. Approve the connection signature. The MCP tool then reports the account as connected.
2. Ask: “Show o1 tokens matching MoonCat” or “Show my ETH balance.” These are read only.
3. Ask: “Prepare a Standard token launch named MoonCat, symbol MCAT, using this image and description.” The agent checks live config and calls the preparation tool.
4. The agent shows the prepared intent. Confirm that specific intent in chat. Open the local page, review the exact transaction, and approve it in the wallet. The wallet broadcasts it.
5. Ask for the status. The agent reports the Base receipt and real transaction hash. o1 indexing may lag the receipt.

Other examples: “Quote buying 0.01 ETH of the token at 0x…”, “Prepare to sell 100 raw units of 0x…”, “Send 0.01 ETH to 0x…”, “Send 100 USDC to 0x…”, and “Show my claimable creator fees.” Amounts for the swap quote tool use base units; the agent must get token decimals and explain units before quoting.

## Security design

- The MCP transport is stdio and the browser bridge listens only on `127.0.0.1`. The bridge uses a random URL-fragment token and checks host, origin, and token on every API call. Never publish or tunnel it.
- Connection requires a Base wallet `personal_sign` challenge. The server verifies the EOA address through Base’s `ecrecover` precompile. A session expires after 15 minutes.
- The server creates wallet-bound, short-lived transaction intents. Each can be requested once. The browser rechecks chain and account immediately before `eth_sendTransaction` and requires a click. The wallet separately asks for approval.
- The returned hash is checked against the reviewed sender, target, value, and calldata on-chain before its receipt can be treated as confirmation.
- The server accepts o1-generated transaction steps only after structural checks, wallet binding, expiry, and successful simulation. Direct transfers construct only the standard transfer calldata from validated addresses and amounts.

## Current limits

- Standard crypto-paired launches only. Tax, stock-paired, $O, Dev Buy, Permit2 typed-data signing, smart wallet EIP-1271 connection, and automatic multi-step ERC-20 prerequisites are not implemented.
- The o1 OpenAPI YAML was unavailable in the build environment. The code uses the [official endpoint guides](https://docs.o1.exchange/launchpad/api/introduction) and fails when an unexpected plan shape appears. Confirm against the current YAML and run a live integration test before mainnet use.
- Only one local wallet session is supported per MCP process. This is not a hosted multi-user service.
- API keys and a browser wallet were unavailable during development, so no live financial transaction was submitted.
- `npm run build` uses Node’s built-in TypeScript type stripping and syntax checks. It does not perform a full TypeScript static type check.

## Update and uninstall

Pull or replace the repository, run `npm run build` and `npm test`, then restart the agent client. To uninstall, remove the local skill folder and the `o1-base-launcher` MCP entry from the client, then delete the repository. Revoking an o1 API key is done in the o1 developer portal. Existing on-chain ERC-20 allowances require an on-chain revoke and are not removed by uninstalling this skill.

## Development

`npm run build`, `npm run lint`, and `npm test` are offline checks. `npm run verify-setup` reads Base chain ID through the configured RPC and reports whether an API key is set; it never prints the key. Tests use fake intents and no live transactions.

API and wallet notes are in `references/`. This repository is MIT licensed.
