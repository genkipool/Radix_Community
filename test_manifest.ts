import { buildStakeManifest } from './features/wallet/lib/manifest-builders';

const manifestObj = buildStakeManifest(
  'account_tdx_2_12x0euekns3m6q649y62zux4pxt986m4u5pnt27cv5r06wmsqerlsk3',
  'validator_tdx_2_1qwwg9c2twwd3tthl2aavunv4783t7p3k79427h8495zstf5a5w58ns',
  100,
  'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxx8yjmac'
);

console.log(typeof manifestObj);
console.log(JSON.stringify(manifestObj, null, 2));
