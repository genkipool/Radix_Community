---
name: radix-community-web
description: Use the Radix Community MCP server to answer questions about the Radix DLT network from the site docs, inspect any on-ledger entity (accounts, components, packages, resources, validators, transactions), and prepare transaction manifests the user signs in the web console with their Radix wallet.
---

# Radix Community Web — MCP skill

MCP server of https://radix-community.genkipool.com (server name: `radix-community`, version 1.0.0).

## Connection

Streamable HTTP endpoint (stateless, no authentication):

```
https://radix-community.genkipool.com/api/mcp
```

Example (Claude Code): `claude mcp add --transport http radix https://radix-community.genkipool.com/api/mcp`

Generic JSON client config:

```json
{
  "mcpServers": {
    "radix": { "type": "http", "url": "https://radix-community.genkipool.com/api/mcp" }
  }
}
```

## How to work with this server

1. **Site questions** ("where is X?", "what does this site offer?") → `get_site_overview`.
2. **Knowledge questions** ("how do NFTs work on Radix?", "where is the validator install guide?") → `search_radix_docs`, then `read_radix_doc` for the full text. Both accept `locale: "en" | "es"` — answer in the user's language.
3. **On-ledger data** (balances, entity state, transactions, validators, NFTs, holders, component state, blueprints) → the ledger tools. All accept `network: "mainnet" | "stokenet"`; default is mainnet. Never mix networks: mainnet addresses contain `_rdx1`, stokenet ones `_tdx_2_1` (`inspect_address` tells you which network an address belongs to).
4. **Actions** (send tokens, stake, create a token, deploy, log in with Radix, …): this server **cannot sign transactions** (it is stateless). The safe pipeline is: build the manifest (console tools) → `validate_transaction_manifest` → `preview_transaction` (real fees and balance changes, no signature) → `explain_manifest` so the user understands it → **sign**. Signing runs on the user's machine through a separate LOCAL MCP server, `radix-connector` (a small binary from the SDK): call `setup_wallet_connector` for the one-time install steps. **Crucial Pairing Flow**: ALWAYS call `list_wallets` first. If a wallet is already paired, skip pairing and proceed to sign. If not paired, call `pair_wallet`. For the QR code: if your interface supports images, save the base64 PNG to a file (e.g., in the workspace root) and display it via markdown. If your interface is a text-only CLI, print the ASCII art QR code directly to the chat so the user can scan it from their terminal. Tell them to scan it in Radix Wallet (Linked Connectors), and IMMEDIATELY call `pair_status` (which will block until they approve). Then use its `send_transaction` / `request_pre_authorization` / `request_account_proof`, or for personas and data `request_login` (persona login, proof verified locally), `request_ownership_proof` (exact accounts / persona, nothing to pick), `request_authorized` (login, login without challenge or use_persona; reset; ONGOING accounts and persona data) and `request_data` (exact or minimum quantities, emails, phone numbers). **The phone shows ONE request at a time and nothing can withdraw one remotely**: send one request, wait for its result, never fire several in parallel. Every connector failure has a `code`, a `stage` and `retry_safe` — if `retry_safe` is NO (e.g. `NO_ANSWER`: the wallet received it but nobody answered) do NOT resend: ask the user to look at the phone and call `await_response`; `PENDING_IN_WALLET` means an earlier request is still waiting (answer it on the phone, or force-close and reopen the wallet if it never shows, then `cancel_request`); `WALLET_UNREACHABLE` / `NOT_DELIVERED` mean it never reached the phone (wallet app closed or in the background — `check_wallet_connection`); `DAPP_NOT_VERIFIED` means the dApp identity would make the wallet refuse or silently drop it (`check_dapp_identity`). Trace any request with `connector_log`; see what is waiting with `pending_requests`. **Don't wait blindly**: if nothing reaches the phone within about a minute, stop and read `connector_log` (request_start → turn_taken → channel_open → delivered → answered) to see where it stopped. **Simulation before the phone (connector ≥ 0.6.0)**: `send_transaction` previews the manifest on the Gateway and does not ring the phone when it would fail (`PREVIEW_FAILED`, retry_safe: yes); pass `preview_only: true` to simulate without sending. **Several processes on one link**: two AI sessions, a sudo prompt or a CLI can share the same paired link, and the wallet keeps ONE channel per link — since 0.6.0 connectors take a machine-wide turn and wait for the wallet to settle; an OLDER connector running beside them can make requests vanish. After `update`, restart the AI tool: a running session keeps the binary it started with (Linux: `/proc/<pid>/exe` ends in `(deleted)`). **No network on the phone?** It can still sign over the USB cable: run the connector's local relay (`radix-connector-mcp relay`), list it in `RADIX_CONNECT_RELAYS`, and set it as the wallet's signaling server (URL ending in `/`, STUN never empty); USB tethering alone is not enough — the phone also needs a WireGuard tunnel to this computer as its default route (PamAuthority: `pamauthority wire`). **dApp identity**: ALWAYS pass `dapp_definition` + `origin` to these calls so the wallet shows a verified dApp instead of "unverified" — they are optional for `send_transaction` but REQUIRED for `request_account_proof` (ROLA login), where they are part of the signed message. Get the values from `get_known_addresses {network}` (origin is always `https://radix-community.genkipool.com`; the dApp definition is per-network). **Before prompting the phone**: the wallet must be switched to the same network as the request (Settings → App Settings → Gateways), or it answers `wrongNetwork`. **Never add `lock_fee`** (or `lock_contingent_fee`) to a manifest: the wallet adds its own fee lock from the fee payer the user picks and rejects a manifest that already has one with `invalidRequest`. The builder tools never emit it. If the user prefers not to install the connector, they can paste the manifest at `https://radix-community.genkipool.com/{locale}/console/transaction-manifest` and sign in the browser instead. **ALWAYS show the final transaction URL to the user using the custom dashboard: https://radix-community.genkipool.com/es/dashboard/tx/<intent_hash>**
5. **AI Safety & Manifest Rules (CRITICAL)**: NEVER write or guess Scrypto transaction manifests manually from memory. Radix manifest syntax changes frequently and is highly complex (e.g., strict Enum typing, Option/None wrapping). ALWAYS use the builder tools provided by this server (`build_fungible_token_manifest`, `build_manifest_from_template`, `build_validator_manifest`, …). Furthermore, BEFORE calling `send_transaction` on the local connector to prompt the user's phone, you MUST pass the manifest through `validate_transaction_manifest`. If validation fails, DO NOT prompt the user; fix the errors or use the builder tools.

6. **Validators**: read the current state with `get_validator_state` before proposing any change, list what is possible with `list_validator_operations`, then build with `build_validator_manifest`, which resolves the owner badges the account holds and composes a single proof for all of them. It refuses the three combinations that go wrong on-ledger, and two of them are silent failures rather than errors: **register + unregister** (or two fee changes) in one transaction COMMIT with the last one quietly winning, and **unstake + claim-xrd on the same validator** aborts the whole transaction. **create-validator** must travel alone. Never hand-assemble a validator manifest to work around a refusal — the refusal is the ledger behaviour, not a limitation of the tool.

   **Bringing a validator up**, in this order:
   1. `create-validator` on its own, with the node's public key (`/system/identity` → `public_key_hex`), the fee factor and a `payment` in XRD. The creation fee is priced in USD, so preview first: the balance changes show what it really costs and any unused XRD comes back to the account. On Stokenet, fund the account with `build_faucet_manifest` beforehand. The owner badge lands in the account as soon as the transaction commits, and the tools read it live.
   2. One transaction with `profile` + `register` + `accept-delegated-stake` (all owner-gated, one proof for the three).
   3. The node operator sets `consensus.validator_address` to the new `validator_…` address on the node and restarts it; without it the node never validates.
   4. `stake-as-owner` once the node is synced (`/system/health` reports `UP`, not `SYNCING`): an active validator whose node is still catching up misses every proposal it is given.

7. **Transient Gateway errors**: a tool failing with `NotSyncedUpError` means the Gateway is over a minute behind the ledger. Wait about 20 seconds and call it again unchanged; nothing about the request is wrong.

## Output format

Every tool returns pre-formatted plain text (banner, aligned key/value rows,
tables, fenced code blocks, and a "Next steps" section). It is designed to be
read as-is — quote it or summarise it for the user, do not re-parse it as data.

## Typical workflows

- *"How do NFTs work on Radix?"* → `search_radix_docs {"query": "NFT"}` → `read_radix_doc` → answer with doc URL.
- *"Where is the validator installation guide?"* → `search_radix_docs {"query": "validator node"}` → share the URL from the result.
- *"What does account_rdx1… hold?"* → `get_account_balances`.
- *"Send 10 XRD to Bob"* → `build_manifest_from_template {"templateId": "transfer-tokens", "values": {…}}` → `preview_transaction` → sign with the local `radix-connector` (`setup_wallet_connector` first if not installed) or in the console.
- *"Sign / actually send this transaction"* → `setup_wallet_connector` (install + pair once) → the local connector's `send_transaction {manifest, network, dapp_definition, origin}` → `transaction_status`.
- *"Create a token called Foo"* → `build_fungible_token_manifest` → `preview_transaction` → user signs in the console.
- *"Create an NFT collection"* → `build_nft_collection_manifest` (name + the initial NFTs) → `preview_transaction` → sign.
- *"Give me test XRD / fund my Stokenet account"* → `build_faucet_manifest {"accountAddress": "account_tdx_2_…"}` → sign (Stokenet only).
- *"Deploy my Scrypto package"* → `build_deploy_package_manifest {"rpdHex": "<.rpd hex>"}` → the local connector's `deploy_package {"wasm_path": "…/pkg.wasm", "package_definition": …}` (it reads the WASM from disk).
- *"Register / unregister my validator, change its fee, key or delegation"* → `get_validator_state` → `build_validator_manifest {"account": "account_…", "operations": [{"kind": "register", "values": {"validator": "validator_…"}}, {"kind": "update-fee", "values": {"validator": "validator_…", "feeFactor": "0.05"}}]}` → `preview_transaction` → sign. Console equivalent: https://radix-community.genkipool.com/en/console/validator-registration.
- *"Set my validator's name, description, icon or website"* → `build_validator_manifest` with a `profile` operation (only the fields you pass are written) → sign. Console: https://radix-community.genkipool.com/en/console/validator-profile.
- *"What can I claim from my unstakes?"* → `list_claimable_stake_nfts {"account": "account_…"}` → feed the matured ids to `build_validator_manifest` as `claim-xrd` → sign. Console: https://radix-community.genkipool.com/en/console/validator-staking.
- *"Create a validator"* → `build_validator_manifest` with a single `create-validator` operation (it cannot share a transaction with anything) → `preview_transaction` → sign → then `profile` + `register` + `accept-delegated-stake` in one transaction → set `consensus.validator_address` on the node → `stake-as-owner` once the node is synced. Console: https://radix-community.genkipool.com/en/console/validator-create.
- *"Which validator should I stake with?"* → `list_validators` → compare fee/uptime/APY → staking page https://radix-community.genkipool.com/en/console/staking.
- *"What is this manifest going to do?"* → `explain_manifest` (plain-language steps) + `preview_transaction` (fees, balance changes).
- *"What's the XRD price / network status?"* → `get_xrd_price`, `get_network_status`.
- *"Log me in / prove who I am"* → the local connector's `request_login {network, dapp_definition, origin}` (the persona signs; add `accounts: {quantity: 1, with_proof: true}` to prove an account in the same approval) → then `request_ownership_proof {identity_address, accounts}` whenever exact accounts must be proven again.
- *"A request never showed on my phone / nothing gets through"* → `pending_requests` → `check_wallet_connection` → `connector_log`; answer or force-close the wallet, then `await_response` or `cancel_request`. Never resend a request whose failure says `retry_safe: NO` If the log shows it never got a turn or a channel, look for other connector processes on the machine (an older version, or a session started before an update) and update/restart them.
- *"What are my accounts / show my balances"* (this server is stateless — it has no "connected wallet") → the local connector's `request_accounts` (no signature) to get the address(es) → `get_account_balances` for the chosen one.
- *"Who holds token X? What NFTs exist in collection Y?"* → `get_resource_holders`, `get_nft_data`.
- *"What methods does component_rdx1… expose? What's in its state?"* → `get_component_blueprint`, `get_component_state`, `get_key_value_store`.

# Tool reference

## Site navigation

### `get_site_overview` — Get site overview

Map of the Radix Community web: every section with its URL and what it offers. Call it first when you need to know where something lives on the site.

- `locale` ("en" | "es"; required, default: "en") — Language of the descriptions and generated URLs: "en" or "es"

## Documentation & knowledge

### `search_radix_docs` — Search Radix docs

Searches the curated documentation of the site (whitepapers, Scrypto/developer guides, node & validator guides, DeFi concepts). Returns matching documents with their URL. Call without "query" to list every available document. Use read_radix_doc to fetch the full content.

- `query` (string; optional) — Free-text search, e.g. "install validator" or "NFT". Omit to list all docs.
- `locale` ("en" | "es"; required, default: "en") — Language of the returned content: "en" (English) or "es" (Spanish)

### `read_radix_doc` — Read a Radix doc

Returns the full content of one curated documentation page as Markdown, in English or Spanish. Get valid doc ids from search_radix_docs.

- `docId` (string; required) — Document id, e.g. "scrypto-basics" or "babylon-guide"
- `locale` ("en" | "es"; required, default: "en") — Language of the returned content: "en" (English) or "es" (Spanish)

## Ledger (on-chain data)

### `lookup_entity` — Look up a ledger entity

Fetches the on-ledger state of any Radix address: accounts, components, packages, resources (tokens/NFTs), validators, pools, … Returns entity type, metadata and a summary of its details. For account token balances prefer get_account_balances.

- `address` (string; required) — Bech32m Radix address, e.g. account_rdx1…, component_rdx1…, package_rdx1…, resource_rdx1…, validator_rdx1…
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `get_account_balances` — Get account balances

Lists the fungible tokens (with amounts) and non-fungible tokens (with local ids) held by a Radix account.

- `address` (string; required) — Account address (account_rdx1… / account_tdx_2_1…)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `get_transaction` — Get transaction details

Fetches a committed transaction by its intent hash (txid_…): status, fee, timestamp, affected entities, balance changes and the transaction manifest.

- `intentHash` (string; required) — Transaction intent hash (txid_…)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `list_validators` — List network validators

Lists the validators of the Radix network ordered by stake rank, with stake, fee, uptime and APY. Filter by name or address with "find". Use it to answer questions about staking targets or a specific validator.

- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)
- `find` (string; optional) — Optional case-insensitive filter on validator name or address
- `limit` (integer; required, default: 20) — Max validators to return

### `get_network_status` — Get network status

Current status of the Radix network: epoch, total XRD staked, number of active validators, average APY and average uptime.

- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `get_xrd_price` — Get XRD market data

Live XRD market data from CoinGecko: price in USD and EUR, 24h change, market cap, circulating supply and total value locked.

_No parameters._

### `get_recent_transactions` — Get recent network transactions

Latest committed transactions network-wide, newest first. Use get_transaction with an intent hash for the full breakdown of one of them.

- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)
- `limit` (integer; required, default: 10) — Max transactions to return

### `get_address_transactions` — Get transactions of an address

Transaction history of any entity (account, validator, component, resource), newest first. The first page already shows the most recent activity, which is what users almost always want. Accounts can have thousands of transactions: do NOT keep paging to the end — only fetch more pages (with the returned cursor) if the user explicitly asks for older history. Use get_transaction for the full breakdown of one of them.

- `address` (string; required) — Bech32m Radix address, e.g. account_rdx1…, component_rdx1…, package_rdx1…, resource_rdx1…, validator_rdx1…
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)
- `limit` (integer; required, default: 10) — Max transactions to return per page
- `cursor` (string; optional) — Pagination cursor from a previous call, to fetch the next (older) page

### `get_nft_data` — Get NFT ids and data

Explores a non-fungible resource (NFT collection): without "ids" it lists the local ids of the collection; with "ids" it returns the decoded on-ledger data (traits, fields) of those NFTs (max 10 per call).

- `resourceAddress` (string; required) — Non-fungible resource address (resource_rdx1…)
- `ids` (array; optional) — NFT local ids, e.g. ["#1#", "#2#"] or ["<member_1>"]. Omit to list the collection ids.
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `get_resource_holders` — Get top holders of a resource

Lists the top holders of any token or NFT collection ordered by amount held, with the total holder count.

- `resourceAddress` (string; required) — Resource address (resource_rdx1…)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `get_component_state` — Get decoded component state

Live decoded on-ledger state of a component (oracle prices, pool reserves, configuration, …) plus its package and blueprint. For the callable methods use get_component_blueprint.

- `address` (string; required) — Component address (component_rdx1… / pool_rdx1…)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `get_key_value_store` — Read a key-value store

Reads the entries of an on-ledger key-value store (component internal storage), decoded to JSON. KVS addresses appear inside component state as internal_keyvaluestore_….

- `address` (string; required) — Key-value store address (internal_keyvaluestore_…)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `get_component_blueprint` — Get blueprint interface

Callable interface of a component or package blueprint: every function/method with its argument names and types. Pass a component address (the blueprint is resolved automatically) or a package address plus optional blueprintName.

- `address` (string; required) — Component (component_rdx1…) or package (package_rdx1…) address
- `blueprintName` (string; optional) — Blueprint name inside a package. Ignored for component addresses.
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

## Console (transactions & developer utilities)

### `list_console_tools` — List console tools

Lists every tool of the web developer console (send transactions, staking, token creation, package deployment, metadata, SBOR decoding, …) with its URL and whether it needs a connected wallet. Use it to route the user to the right console page.

- `locale` ("en" | "es"; required, default: "en") — Language of the returned labels/links: "en" or "es"

### `list_manifest_templates` — List manifest templates

Lists the ready-made transaction manifest templates (transfer tokens/NFTs, stake, unstake, claim, mint, burn, create pool, faucet, …) with the fields each one needs. Use build_manifest_from_template to render one.

- `locale` ("en" | "es"; required, default: "en") — Language of the returned labels/links: "en" or "es"

### `build_manifest_from_template` — Build manifest from template

Renders a ready-made transaction manifest template (see list_manifest_templates for ids and fields) with the given field values, validates it, and returns the manifest ready to be signed in the web console.

- `templateId` (string; required) — Template id from list_manifest_templates
- `values` (object; required) — Field values keyed by field key, e.g. { "from": "account_rdx1…", "amount": "10" }
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)
- `locale` ("en" | "es"; required, default: "en") — Language of the returned labels/links: "en" or "es"

### `build_fungible_token_manifest` — Build fungible token manifest

Builds the transaction manifest that creates a new fungible token on Radix with sensible defaults (owner: none, transfers open). The initial supply is deposited into the given account. For NFTs use build_nft_collection_manifest; for advanced role setups send the user to the console create-token tool.

- `accountAddress` (string; required) — Account that receives the initial supply
- `name` (string; required) — Token name, e.g. "My Token"
- `symbol` (string; required) — Ticker symbol, e.g. "MTK"
- `description` (string; optional) — Token description
- `iconUrl` (string; optional) — HTTPS URL of the token icon
- `initialSupply` (string; required) — Initial supply as decimal string, e.g. "1000000"
- `divisibility` (integer; required, default: 18) — Decimal places (0-18)
- `mintable` (boolean; required, default: false) — Allow anyone to mint more supply
- `burnable` (boolean; required, default: false) — Allow anyone to burn supply
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)
- `locale` ("en" | "es"; required, default: "en") — Language of the returned labels/links: "en" or "es"

### `build_nft_collection_manifest` — Build NFT collection manifest

Builds the transaction manifest that creates a new non-fungible resource (NFT collection) on Radix with a set of initial NFTs (name, description, image), sensible defaults (owner: none, transfers open). The NFTs are deposited into the given account. For custom data fields or advanced role setups, send the user to the console create-token tool.

- `accountAddress` (string; required) — Account that receives the minted NFTs
- `name` (string; required) — Collection name, e.g. "My Collection"
- `description` (string; optional) — Collection description
- `iconUrl` (string; optional) — HTTPS URL of the collection icon
- `nfts` (array; required) — Initial NFTs to mint into the collection
- `mintable` (boolean; required, default: false) — Allow minting more NFTs later
- `burnable` (boolean; required, default: false) — Allow burning NFTs
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)
- `locale` ("en" | "es"; required, default: "en") — Language of the returned labels/links: "en" or "es"

### `build_faucet_manifest` — Build a Stokenet faucet manifest

Builds the manifest that requests free test XRD from the Stokenet faucet and deposits it into an account. Stokenet only — mainnet has no faucet. Use it to fund a test account before other transactions.

- `accountAddress` (string; required) — Stokenet account to fund (account_tdx_2_…)
- `locale` ("en" | "es"; required, default: "en") — Language of the returned labels/links: "en" or "es"

### `build_deploy_package_manifest` — Prepare a Scrypto package deployment

Decodes a compiled .rpd package definition (Manifest SBOR) into the value needed to publish a Scrypto package, and returns the exact deploy_package call to run on the local radix-connector. The WASM is NOT handled here (too large for the agent) — the connector reads it from disk. Use this before deploy_package.

- `rpdHex` (string; required) — Hex-encoded contents of the compiled .rpd package-definition file
- `owner` ("none" | "allowAll"; required, default: "none") — Package owner: "none" (no owner) or "allowAll" (anyone can update it)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `validate_transaction_manifest` — Validate a transaction manifest

Statically validates Radix transaction manifest syntax with the Radix Engine Toolkit and reports the exact parse error if invalid.

- `manifest` (string; required) — Transaction manifest source text
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `preview_transaction` — Preview (simulate) a transaction

Dry-runs a transaction manifest on the Gateway without any signature: returns the execution status, total fee in XRD, per-entity balance changes and engine logs. Always preview a manifest before asking the user to sign it.

- `manifest` (string; required) — Transaction manifest source text
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)
- `locale` ("en" | "es"; required, default: "en") — Language of the returned labels/links: "en" or "es"
- `blobs` (array; optional) — Hex-encoded blobs referenced by the manifest via Blob("<hash>"), e.g. package WASM. Required to dry-run a package deploy.

### `explain_manifest` — Explain a transaction manifest

Translates a Radix transaction manifest into a plain-language, step-by-step explanation (withdrawals, deposits, proofs, component calls, …) in English or Spanish. Use it to help the user understand what they are about to sign.

- `manifest` (string; required) — Transaction manifest source text
- `locale` ("en" | "es"; required, default: "en") — Language of the returned labels/links: "en" or "es"

### `decode_sbor` — Decode an SBOR payload

Decodes a hex-encoded SBOR payload (component state, events, schemas) into human-readable text. Scrypto vs Manifest SBOR is auto-detected from the prefix byte.

- `hex` (string; required) — Hex-encoded SBOR payload (starts with 5c for Scrypto, 4d for Manifest)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `convert_olympia_address` — Convert Olympia address

Converts a legacy Olympia address (rdx1… account or _rr1… resource) into its Babylon equivalent. For accounts it also returns the compressed secp256k1 public key embedded in the address, and the wallet-import QR payload string the Radix Wallet scans to import the legacy account (Settings → "Import from a Legacy Wallet"). Render that string as a QR (or save it) to complete the import. The payload holds only public data, never a seed phrase or private key.

- `olympiaAddress` (string; required) — Olympia address (rdx1… or …_rr1…)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)
- `accountType` ("S" | "H"; required, default: "S") — Original Olympia account type: "S" software (seed phrase) or "H" hardware (Ledger).
- `addressIndex` (integer; required, default: 0) — BIP44 address index the account was derived with (0 for the first account).
- `accountName` (string; required, default: "") — Display name shown in the mobile wallet during import (max 30 chars).
- `wordCount` (any; required, default: 12) — Seed-phrase word count of the original Olympia wallet (12, 15, 18, 21 or 24).

### `resolve_vault_address` — Resolve a vault address

Resolves the internal vault address holding a resource in an account (the target a recall/freeze needs). An account holds a resource in exactly one vault. For non-fungibles it also returns the NFT ids in that vault. Feed the vault into the recall-token / recall-nft / freeze-vault / unfreeze-vault manifest templates.

- `account` (string; required) — Account address (account_…) that holds the resource.
- `resource` (string; required) — Resource address (resource_…) to locate in the account.
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `inspect_address` — Inspect a Radix address

Offline analysis of any Radix bech32m address: entity type (account, resource, component, package, validator, …), network, and checksum validity. No network calls.

- `address` (string; required) — Any Radix address or transaction id

### `verify_account_security` — Verify how an account is protected

Reads from the ledger who actually controls a Radix account: its key (one seed phrase, no recovery), or an account owner badge. When it is a badge, it also says whether that badge sits in an Access Controller (multi-factor with recovery) or loose in an account. Reports the controller's roles, its timed-recovery delay and any recovery or badge-withdrawal attempt in flight. Read-only.

- `address` (string; required) — Account address (account_rdx1… / account_tdx_2_1…)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `get_known_addresses` — Get well-known network addresses

Canonical well-known addresses of a network: XRD resource, faucet, native packages (account, pool, validator, …), system badges, plus this site's dApp definition + origin to pass to the wallet when signing. Use it to fill manifest addresses without guessing.

- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `list_validator_operations` — List validator operations

Lists every operation a validator supports (register, unregister, change fee, change consensus key, open/close delegation, protocol update vote, public profile metadata, stake, unstake, claim, owner locked stake units, create validator) with whether it needs the owner badge and whether it can share a transaction with the others. Use it before build_validator_manifest.

_No parameters._

### `get_validator_state` — Read validator state

Reads a validator from the ledger: whether it is registered, whether it accepts delegated stake, its fee factor, consensus public key, and the stake unit (LSU) and claim NFT resources it mints. Use it to know the current state before proposing a change.

- `validator` (string; required) — Validator component address (validator_…)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `list_claimable_stake_nfts` — List stake claim NFTs

Lists the stake claim NFTs an account holds, each attributed to the validator that minted it, with the XRD it redeems for and whether it has matured. Feed the matured ones to build_validator_manifest as a claim-xrd operation.

- `account` (string; required) — Account address (account_…)
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `build_validator_manifest` — Build validator manifest

Builds one transaction manifest out of one or more validator operations, resolving the owner badges the account holds and composing a single proof for all of them. Refuses combinations the ledger would garble. Returns the manifest for the user to sign in their Radix wallet.

- `account` (string; required) — Account that signs, pays the fee and presents the owner badges
- `operations` (array; required) — Operations to combine in one transaction
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)

### `verify_document_signature` — Verify a document-signature certificate

Verifies a Radix Seal document-attestation certificate (the contents of a .radixsig.json file). Checks every signature against the shared payload — ROLA proofs and/or the on-ledger chain of custody — and reports whether the certificate is complete. It receives ONLY the certificate, never the document itself.

- `certificate` (string; required) — The certificate JSON: the full contents of the .radixsig.json file.

### `check_signing_request` — Check a Radix Seal signing request

Reads the on-ledger status of a Radix Seal signing request by its id (the first invitation NFT global id, e.g. "resource_tdx_2_1...:#25#"). Returns the required signers, who has signed, and whether the request is complete. Read-only Gateway query.

- `requestId` (string; required) — Request id: the first invitation NFT global id, e.g. "resource_tdx_2_1...:#25#".
- `network` ("mainnet" | "stokenet"; required, default: "mainnet") — Radix network: "mainnet" (production) or "stokenet" (testnet)
- `docHash` (string; optional) — Optional document hash (blake2b-256, 64 hex chars) to confirm the request anchors the expected file.

### `setup_wallet_connector` — Set up local wallet signing

Explains how to install and use the LOCAL Radix signing connector (radix-connector-mcp) so the user can sign and submit transactions with their Radix Wallet. This HTTP server cannot sign (it is stateless); the local connector holds the wallet channel and the phone approves. Call this when the user wants to send/sign a transaction, stake, create a token, deploy, or log in with Radix.

- `client` ("claude-code" | "claude-desktop" | "cursor" | "antigravity" | "generic"; required, default: "generic") — Which MCP client the user runs, so the registration snippet matches it.
- `os` ("linux" | "macos" | "windows"; optional) — User OS, to show the matching prebuilt-binary installer. Omit to show all.
