# DEX test doubles

Scrypto package with the blueprint names, methods and state fields of Ociswap's
`BasicPool`, `Pool` (Flex) and `PrecisionPool` and DefiPlaza's `PlazaPair`, so the
console's DEX lookups and manifests run on resim (`__tests__/console/dex-resim.test.ts`)
and on Stokenet, where those DEXes are not deployed. Test only: `add_fees` and
`set_shortage` let anyone put the components in the states the tests need.

`build/` holds the compiled package the tests publish. To rebuild it:

```sh
scrypto build
cp target/wasm32-unknown-unknown/release/dex_mocks.{wasm,rpd} build/
```

`build.rs` lets newer Rust link the engine's imports, which the Radix engine
supplies at runtime.
