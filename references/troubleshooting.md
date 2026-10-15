# Troubleshooting

- **No wallet extension:** Open the local URL in a browser profile with an EIP-1193 wallet. The Codex in-app browser may not have your wallet extension.
- **Wrong chain:** Switch the wallet to Base Mainnet (8453). The bridge requests this automatically when supported.
- **Challenge fails:** Retry connection. The challenge lasts five minutes and requires a standard EOA `personal_sign` signature. Smart contract accounts are not supported yet.
- **Quote stale or plan expired:** Request a fresh quote or preparation; review it again. Do not retry old calldata.
- **Approval prerequisite:** Approve the returned exact amount as a separate transaction if the API supplies a validated step, wait for a receipt, then obtain a fresh o1 preparation. Permit2 typed-data signatures are not supported.
- **Insufficient ETH:** Fund both the transaction value and estimated gas. A token balance alone is not enough for ERC-20 transfer gas.
- **Submitted but pending:** Poll `get_transaction_status`. A returned hash is not a confirmed receipt.
- **API key error:** Create a scoped key in the [o1 developer portal](https://launch.o1.exchange/developers) and expose it only as `O1_API_KEY` in the local MCP process environment.
