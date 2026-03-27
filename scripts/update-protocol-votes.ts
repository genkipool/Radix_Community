import { GatewayApiClient, RadixNetwork } from '@radixdlt/babylon-gateway-api-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname since we might run via npx tsx
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const gateway = GatewayApiClient.initialize({
    networkId: RadixNetwork.Mainnet,
    applicationName: 'RadixDashboard',
});

// We only scan back to the epoch when Cuttlefish started voting
// Adjust this for future protocol updates (e.g., epoch of announcement)
const START_EPOCH = 150000;

async function findVoteWithRetry(validatorAddress: string, retries = 3): Promise<string | null> {
    let cursor: string | undefined = undefined;
    let pages = 0;

    while (pages < 5) { // Protect from scanning infinite pages
        try {
            const res = await gateway.stream.innerClient.streamTransactions({
                streamTransactionsRequest: {
                    from_ledger_state: { epoch: START_EPOCH },
                    affected_global_entities_filter: [validatorAddress],
                    order: 'Asc',
                    limit_per_page: 50,
                    cursor: cursor || undefined,
                    opt_ins: { receipt_events: true }
                }
            });

            pages++;
            for (const tx of res.items || []) {
                const events = tx.receipt?.events || [];
                const voteEvent = (events as Array<{ name: string; data?: { fields?: Array<{ field_name: string; value: string }> } }>).find((e) => e.name === 'ProtocolUpdateReadinessSignalEvent');
                if (voteEvent) {
                    const signal = voteEvent.data?.fields?.find((f) => f.field_name === 'protocol_version_name')?.value;
                    return signal || null;
                }
            }
            cursor = res.next_cursor || undefined;
            if (!cursor) {
                return null; // Explored all available without finding
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`\n[!] Error scanning ${validatorAddress}: ${message}`);
            if (retries > 0) {
                console.log(`Retrying ${validatorAddress}... (${retries} left)`);
                await new Promise(r => setTimeout(r, 2000));
                return findVoteWithRetry(validatorAddress, retries - 1);
            }
            return null;
        }
    }
    return null;
}

// BATCH SIZE to prevent Cloudflare 524 Timeouts on the Gateway
const BATCH_SIZE = 5;

async function updateProtocolVotes() {
    console.log('Fetching active validators...');
    const validators = await gateway.state.getAllValidators();
    const active = validators.filter(v => (v as unknown as { active_in_epoch?: unknown }).active_in_epoch);
    console.log(`Found ${active.length} active validators.`);

    const votesMap: Record<string, string> = {};
    let votedCount = 0;

    for (let i = 0; i < active.length; i += BATCH_SIZE) {
        const batch = active.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i / BATCH_SIZE + 1} / ${Math.ceil(active.length / BATCH_SIZE)}...`);

        await Promise.all(batch.map(async (v) => {
            console.log(`Scanning txs for ${v.address}...`);
            const signal = await findVoteWithRetry(v.address);
            if (signal) {
                votesMap[v.address] = signal;
                votedCount++;
            }
        }));
    }

    console.log(`\nFinished scanning! ${votedCount}/${active.length} active validators have a vote signal.`);

    // Save to constants folder so the backend can import it statically
    const outputPath = path.join(__dirname, '..', 'constants', 'protocol-votes.json');
    fs.writeFileSync(outputPath, JSON.stringify(votesMap, null, 2), 'utf8');
    console.log(`Votes saved to ${outputPath}`);
}

updateProtocolVotes().catch(console.error);
