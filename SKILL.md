---
name: o1-base-launcher
description: Launch and trade o1 Launchpad tokens on Base and prepare wallet approved transfers through the local o1 Base Launcher MCP server.
---

# o1 Base Launcher

Use this skill for o1 Launchpad token discovery, Standard token launches, exact input buys and sells, creator fee claims, balances, and ETH/ERC-20 transfers on Base Mainnet (8453). The `o1-base-launcher` MCP server must be registered. The optional `base-docs` MCP is documentation only; it never connects or signs a wallet.

## Start

1. Check for the MCP tools `connect_base_wallet`, `get_o1_config`, and `request_wallet_approval`. If absent, direct the user to [README.md](README.md); do not invent tool results.
2. Call `connect_base_wallet` and give the returned local URL to the user. A URL is only a pending connection. Call `get_connected_wallet` after the user connects in the browser. Never ask for a seed phrase, private key, or exported wallet file.
3. For read operations, call the corresponding MCP tool and report only returned data. Keep API keys in the MCP process environment, never in chat.

## Financial operations

- Resolve token identities with `search_o1_tokens` and `get_o1_token_details`. If a symbol is ambiguous, ask the user to choose an address.
- For a Standard launch, call `get_o1_config`, collect the name, symbol, description, image base64 and type, and a live creation-available quote address. Call `prepare_token_launch` once per intended launch. Tax, stock-paired, $O, and Dev Buy launches are outside this implementation.
- For a buy or sell, get a fresh quote with `get_swap_quote`, display the returned input, expected output, minimum output, slippage, fees, issues, and expiry. Resolve approval prerequisites before preparing. Then call `prepare_buy_token` or `prepare_sell_token` with that exact quote ID.
- For a transfer or creator fee claim, use the matching `prepare_*` tool. Never construct calldata or target addresses in chat.
- Present every returned intent's recipient/target, value, decoded purpose, fee/gas information when available, and expiry to the user. Obtain the user's explicit confirmation for that specific intent. Only then call `request_wallet_approval` with its intent ID and `CONFIRM`. The wallet page and wallet extension require separate human approval. A chat command alone is not approval.
- If the user rejects in the wallet, stop. Do not retry or request another approval unless the user asks. For expiry, balance, quote, simulation, or chain errors, explain the error and prepare a new quote or plan after the user chooses to continue.
- Poll `get_transaction_status` for a real receipt. A prepared plan, wallet popup, or submitted hash is not a confirmed transaction. Report the Basescan link only with its real hash and receipt state.

## Limits

The local bridge uses an EIP-1193 browser wallet extension and one wallet session per MCP process. It is for a single local user on loopback, not shared or remote MCP hosting. It does not support Permit2 signatures or automatic multi-step approvals. A returned prerequisite requires a separate reviewed and confirmed transaction, then fresh o1 preparation. Never bypass an unsupported response shape.

See [references/o1-api.md](references/o1-api.md) for API behavior and [references/base-wallet.md](references/base-wallet.md) for the wallet flow.
