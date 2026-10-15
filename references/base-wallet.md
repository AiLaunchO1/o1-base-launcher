# Local Base wallet bridge

The MCP process opens an HTTP listener on `127.0.0.1` with a random port. The `connect_base_wallet` tool returns its URL with a 256-bit session token in the URL fragment. The fragment is not sent in the HTTP request. The page moves it into memory and removes it from browser history.

The browser requests an EIP-1193 wallet account, switches to Base chain ID `0x2105`, asks the wallet to sign a short-lived local challenge, and sends the signature to the bridge. The bridge hashes it with Ethereum Keccak-256 and verifies the recovered EOA address through Base's `ecrecover` precompile. Sessions expire after 15 minutes. EIP-1271 smart accounts are not yet supported.

Each prepared intent is server-created, wallet bound, expires, and can be requested once. The browser checks account and chain again before `eth_sendTransaction`. The user sees the exact target, value, and calldata on the page and in the wallet. The bridge never holds a private key. It accepts the returned hash, then checks the actual on-chain transaction fields and receipt. A hash alone is not success.

The bridge is intended only for one local user per MCP process. Do not expose the listener through a tunnel or proxy, or share the URL. The Base Docs MCP is a read-only documentation service, not a wallet provider. See [Base Docs MCP](https://docs.base.org/get-started/docs-mcp) and [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193).
