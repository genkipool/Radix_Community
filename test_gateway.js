const address = "account_rdx16996e90weeevvqww58p5cufhnnz0lyw5sntc6vmmwrtntgxy5j9w56";
const network = "mainnet";

fetch(`https://mainnet.radixdlt.com/stream/transactions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    affected_global_entities_filter: [address],
    opt_ins: {
      balance_changes: true,
      receipt_events: true,
      confirmed_at: true,
      receipt_state_changes: true,
      receipt_fee_destination: true
    },
    limit_per_page: 2
  })
}).then(r => r.json()).then(data => {
  console.log(JSON.stringify(data.items.map(item => ({
    intent_hash: item.intent_hash,
    fungible: item.balance_changes.fungible_balance_changes?.filter(f => f.entity_address === address),
    fee: item.balance_changes.fungible_fee_balance_changes?.filter(f => f.entity_address === address)
  })), null, 2));
});
