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
| ip-api.com `fields=status,countryCode,isp,org,as,asname,hosting` | who hosts each IP: the provider and whether it is a datacenter (same cache, same request as the country) |

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
| `provider` | who hosts the IP ("Hetzner", "AWS", "OVH"…), see "Hosting provider"; `null` when it cannot be placed |
| `hosting` | `true` when the IP belongs to a datacenter / hosting network, `false` for a home or office line, `null` unknown |

No IP address is published (only the country and the provider's name). The web ignores the view once `updatedAt` is older
than 20 minutes.

## Hosting provider

The web groups the active validators by `provider` to say how spread out the
network is (staking view → network panel → "Network health"). Without the field
it shows "unknown" and gives no verdict, so nothing breaks while the script is
not updated; the web reads `provider` and `hosting` when they are there.

Ask ip-api.com for the extra fields in the call that already locates the IP and
keep them in the same weekly cache, then publish what this function returns
(checked against live answers: `5.9.0.1` → Hetzner, `8.8.8.8` → Google Cloud,
`13.107.4.52` → Azure, `51.38.0.1` → OVH, `159.203.0.1` → DigitalOcean):

```python
import re

# (pattern in isp / org / asname / as, name shown). First match wins.
KNOWN = [
    (r"hetzner", "Hetzner"), (r"amazon|aws\b|\bec2\b", "AWS"), (r"google", "Google Cloud"),
    (r"microsoft|azure", "Azure"), (r"ovh", "OVH"), (r"digitalocean|digital ocean", "DigitalOcean"),
    (r"contabo", "Contabo"), (r"vultr|choopa|constant company", "Vultr"), (r"linode|akamai", "Akamai/Linode"),
    (r"oracle", "Oracle Cloud"), (r"alibaba|aliyun", "Alibaba Cloud"), (r"tencent", "Tencent Cloud"),
    (r"scaleway|online\.net|iliad", "Scaleway"), (r"leaseweb", "Leaseweb"), (r"ionos|1&1|1and1", "IONOS"),
    (r"cloudflare", "Cloudflare"), (r"equinix|packet", "Equinix"), (r"latitude\.sh|maxihost", "Latitude.sh"),
    (r"hostinger", "Hostinger"), (r"upcloud", "UpCloud"), (r"zenlayer", "Zenlayer"), (r"m247", "M247"),
    (r"servers\.com|serverscom", "Servers.com"), (r"netcup", "netcup"), (r"strato", "STRATO"),
    (r"rackspace", "Rackspace"), (r"ibm|softlayer", "IBM Cloud"), (r"cherry servers", "Cherry Servers"),
    (r"gcore", "Gcore"), (r"hivelocity", "Hivelocity"), (r"colocrossing", "ColoCrossing"),
    (r"datapacket|cdn77", "DataPacket"), (r"worldstream", "Worldstream"), (r"tzulo", "tzulo"),
]

def provider_from_ipapi(data):
    """(provider, hosting) from an ip-api.com answer; (None, None) when it cannot be placed."""
    if not isinstance(data, dict) or data.get("status") != "success":
        return None, None
    hosting = data.get("hosting") if isinstance(data.get("hosting"), bool) else None
    text = " ".join(str(data.get(k) or "") for k in ("isp", "org", "asname", "as")).lower()
    for pattern, name in KNOWN:
        if re.search(pattern, text):
            return name, hosting
    # A name not in the list: the ISP as published, short, so it still groups.
    raw = (data.get("isp") or data.get("org") or "").strip()
    raw = re.sub(r"\b(inc|llc|ltd|gmbh|s\.?a\.?|b\.?v\.?|ab|ag|co|corp|corporation|limited)\b\.?,?", "", raw, flags=re.I).strip(" ,.-")
    return (raw[:40] or None), hosting
```

Then add the two values to each node's entry (steps 1–2 of "Adding a field"). The
web side is already done (`ValidatorNodeTelemetry`, `parseNodeTelemetry`, the
facts row and the network-health section).

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
