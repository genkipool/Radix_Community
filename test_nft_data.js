const http = require('https');

const req = http.request("https://mainnet.radixdlt.com/state/non-fungible/data", {
  method: "POST",
  headers: { "Content-Type": "application/json" }
}, (res) => {
  let chunks = [];
  res.on("data", d => chunks.push(d));
  res.on("end", () => {
    console.log(Buffer.concat(chunks).toString());
  });
});

req.write(JSON.stringify({
  "resource_address": "resource_rdx1nflxxq5pysy6xngs3895u89s3f9z6x972h90x89qshsz7g48r3s5st",
  "non_fungible_ids": ["[d11cfc63261cf388912d09549f3e4905cdcefd156094ab2d7eeb5584]"]
}));
req.end();
