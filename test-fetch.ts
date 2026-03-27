import { fetchTransactionDetails } from './services/gateway/transactions.js';

fetchTransactionDetails('txid_rdx103vlzv4y3uq6l5ln8hs5r6fmtlnkjmwmpzzqkwg0ap2v2vs80nvsntfplu', 'mainnet')
  .then(res => {
      console.log(res ? "SUCCESS. Keys: " + Object.keys(res).join(", ") : "NULL RETURNED");
  })
  .catch(e => {
      console.error("ERROR", e);
  });
