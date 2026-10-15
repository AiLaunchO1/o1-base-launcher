# o1 Launchpad API notes

The server uses the Launchpad API at `https://api.launch.o1.exchange/v1`. It does not use the separate DEX Aggregator API. Send `x-api-key` for all routes except `/health`. A Standard launch sends an `Idempotency-Key`; expired plans require a new preparation and key. Swap quote IDs are short lived and wallet bound. A successful HTTP response can still contain action-required or blocking `issues`.

Verified routes: `GET /config`, `GET /tokens/search`, `GET /tokens/{chain_id}/{address}`, `GET /creators/{address}/tokens`, `GET /wallets/{address}/fee-claims`, `GET /transactions/{chain_id}/{hash}`, `POST /launches/prepare`, `POST /swaps/quote`, `POST /swaps/prepare`, `POST /claims/fees/prepare`.

The o1 API prepares unsigned steps. The local wallet signs and broadcasts. The API's transaction index is slower than an RPC receipt, so use Base RPC for immediate confirmation. Do not reuse an expired quote or plan, or alter returned calldata.

This repository was built from the official endpoint guides because the downloadable OpenAPI YAML could not be fetched in the build environment. An unexpected response shape fails closed. Before a production release, obtain the current OpenAPI file, compare schemas, and run live integration tests with a funded test wallet and a scoped key.

Official references: [Public API](https://docs.o1.exchange/launchpad/api/introduction), [launch preparation](https://docs.o1.exchange/launchpad/api/launches), [trading](https://docs.o1.exchange/launchpad/api/trading), [claims](https://docs.o1.exchange/launchpad/api/claims-and-creator-actions), [read routes](https://docs.o1.exchange/launchpad/api/read-endpoints), [errors](https://docs.o1.exchange/launchpad/api/errors-and-limits).
