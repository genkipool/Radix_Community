const http = require('https');

const req = http.request("https://mainnet.radixdlt.com/state/entity/details", {
  method: "POST",
  headers: { "Content-Type": "application/json" }
}, (res) => {
  let chunks = [];
  res.on("data", d => chunks.push(d));
  res.on("end", () => {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    const acc = data.items[0];
    const ftList = acc.fungible_resources.items;
    const nftList = acc.non_fungible_resources.items;
    
    console.log(`Found ${ftList.length} fungibles and ${nftList.length} non-fungibles`);
    
    const lsuTokens = [];
    const poolUnits = [];
    const xrdTokens = [];
    
    for (const ft of ftList) {
      if (ft.resource_address === "resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd") {
        xrdTokens.push(ft);
        continue;
      }
      let isLsu = false;
      let isPu = false;
      let validator = null;
      for (const m of ft.explicit_metadata?.items || []) {
        if (m.key === "validator") { isLsu = true; validator = m; }
        if (m.key === "pool_unit") isPu = true;
      }
      if (isLsu) lsuTokens.push({addr: ft.resource_address, val: validator.value?.typed?.value});
      if (isPu) poolUnits.push(ft.resource_address);
    }
    
    console.log("XRD:", xrdTokens.map(x=>x.amount));
    console.log("LSUs:", lsuTokens);
    console.log("Pool Units:", poolUnits);
    
    const claimNFTs = [];
    for (const nft of nftList) {
       let isClaim = false;
       for (const m of nft.explicit_metadata?.items || []) {
         if (m.key === "claim_nft") isClaim = true;
       }
       if (isClaim) claimNFTs.push(nft);
    }
    console.log("Claim NFTs Count:", claimNFTs.length);
    if(claimNFTs.length > 0) {
      console.log("First claim NFT collection:", claimNFTs[0].resource_address);
      console.log("Vault items:", claimNFTs[0].vaults?.items[0]?.items);
    }
  });
});

req.write(JSON.stringify({
  "addresses":["account_rdx168u7hevd7s30a3hj8cu6qvp4ffehm5f3xvzet3gspdsdc2cq7y6tjq"],
  "opt_ins": {
    "non_fungible_include_nfids": true,
    "explicit_metadata":["name", "symbol", "validator", "pool_unit", "claim_nft", "icon_url"]
  }
}));
req.end();
