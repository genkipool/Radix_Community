# node-telemetry

Publishes what our full node knows about every validator node (country, whether
it is connected to ours, whether its gossip port accepts connections, version
and commit) to Upstash Redis. `services/nodeTelemetry.ts` weighs it against
consensus and folds it into the validator list shown by staking and the
explorer.

Runs on the full node (`gRadixFull`, `~/node-telemetry/node_telemetry.py`)
every five minutes from cron. Standard library only.

## Sources

| Source | Gives |
| --- | --- |
| Gateway `/state/validators/list` (hourly) | which node keys are validators; only those are published |
| `babylonnode api system peers` | connected nodes: IP, version, commit, whether our node dialled them |
| `babylonnode api system addressbook` | addresses of nodes our node is not connected to |
| System API `identity` and `version` | our own node, which never appears among its own peers |
| TCP connect to the gossip port | whether a node accepts inbound connections (for our own node: a peer dialling in, or its public address answering) |
| ip-api.com, country.is | country of each IP (cached for a week) |

## Data

| Redis key | Type | Content |
| --- | --- | --- |
| `validator_nodes_<network>` | hash | node public key (hex) → entry |
| `validator_nodes_<network>_meta` | string | `{updatedAt, peers, nodes}` of the latest run |

Entry fields:

| Field | Meaning |
| --- | --- |
| `countryCode` | ISO 3166-1 alpha-2 country of its IP |
| `online` | connected to our node within the last 30 minutes |
| `acceptsConnections` | its port answered (`true`) or not (`false`); `null` with no known address |
| `version`, `commit` | build it reports, only real releases (`v1.4.0.0`) |
| `lastSeen` | last time connected, `0` when only known from the address book |

No IP address is published. The web ignores the view once `updatedAt` is older
than 20 minutes.

## How the web decides "online"

1. Active validators: consensus. Producing proposals → online. No proposal made
   and at least 2 missed in the last two epochs (or 1 missed with a 14-day
   uptime under 50%) → offline.
2. Otherwise: connected to our node → online; port answers → online; port
   closed → offline.
3. Nothing to go on → unknown, shown as "Sin datos".

## Install

```bash
scp scripts/node-telemetry/node_telemetry.py gRadixFull:node-telemetry/

# On the node: Upstash credentials, readable only by the node user
umask 077; mkdir -p ~/.config/node-telemetry
cat > ~/.config/node-telemetry/env <<'EOF'
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
RADIX_NETWORK=mainnet
EOF

# Check the view without writing to Redis
python3 ~/node-telemetry/node_telemetry.py --dry-run | head

# Every five minutes
(crontab -l 2>/dev/null | grep -v node_telemetry.py; \
 echo '*/5 * * * * PATH=/usr/local/bin:/usr/bin:/bin /usr/bin/python3 $HOME/node-telemetry/node_telemetry.py >> $HOME/.local/state/node-telemetry/cron.log 2>&1') | crontab -
```

`babylonnode` needs the NGINX credentials from the operator's shell. When
`NGINX_ADMIN_PASSWORD` is not in the environment the script runs it through
`bash -ic`, so the password never has to be copied anywhere.

Local state lives in `~/.local/state/node-telemetry/` (validator keys, geo
cache, last view, cron log).

## Adding a field

1. Extract it in `extract_peers` or `extract_addressbook` and carry it through `NodeEntry`.
2. Add it to `ValidatorNodeTelemetry` (`types/radix.ts`) and `parseNodeTelemetry`.
3. Show it: `ValidatorNodeFacts` lists the facts of the expanded card and the explorer.
