import { QueryClient, dehydrate, defaultShouldDehydrateQuery } from '@tanstack/react-query';

const client = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 0, gcTime: 1000 * 60 * 5 },
        dehydrate: {
            shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
        }
    }
});

client.setQueryData(['tx-details', 'txid_foo', 'mainnet'], { id: 1, name: "test" });
client.setQueryData(['entity', 'mainnet', 'resource_xrd'], { symbol: "XRD" });

const d = dehydrate(client);
console.log("Dehydrated state:", JSON.stringify(d, null, 2));
