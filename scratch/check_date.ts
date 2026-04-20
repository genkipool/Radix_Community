import { StreamTransactionsRequestToJSON } from '@radixdlt/babylon-gateway-api-sdk/dist/generated/models/StreamTransactionsRequest';
console.log(StreamTransactionsRequestToJSON({
    from_ledger_state: { timestamp: new Date('2024-04-10T00:00:00.000Z') }
}));
