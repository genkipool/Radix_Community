import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';

async function main() {
    // Generate a valid manifest for an NFT
    try {
        const result = await RadixEngineToolkit.Instructions.staticallyValidate({
            kind: 'String',
            value: `
CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    Enum<1u8>(
        Enum<2u8>(
            Enum<0u8>(
                Enum<0u8>(
                    Enum<1u8>(
                        Address("resource_sim1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxakj8n3")
                    )
                )
            )
        )
      )
    Enum<1u8>()
    true
    Enum<0u8>(
      Enum<0u8>(
          Tuple(
              Array<Enum>(
                  Enum<14u8>(
                      Array<Enum>(
                          Enum<0u8>(12u8)
                      )
                  )
              ),
              Array<Tuple>(
                  Tuple(
                      Enum<1u8>("DataSchema"),
                      Enum<1u8>(
                          Enum<0u8>(
                              Array<String>("name")
                          )
                      )
                  )
              ),
              Array<Enum>(Enum<0u8>())
          )
      ),
      Enum<1u8>(1u64),
      Array<String>()
    )
    Map<NonFungibleLocalId, Tuple>(
      NonFungibleLocalId("#0#") => Tuple(
        Tuple(
          "NFT Místico #1884-1"
        )
      )
    )
    Tuple(
      Some(Tuple(Some(Enum<AccessRule::AllowAll>()), None)),
      Some(Tuple(Some(Enum<AccessRule::AllowAll>()), None)),
      Some(Tuple(Some(Enum<AccessRule::AllowAll>()), None)),
      Some(Tuple(Some(Enum<AccessRule::AllowAll>()), None)),
      Some(Tuple(Some(Enum<AccessRule::AllowAll>()), None)),
      Some(Tuple(Some(Enum<AccessRule::AllowAll>()), None)),
      Some(Tuple(Some(Enum<AccessRule::AllowAll>()), None))
    )
    Tuple(
      Map<String, Tuple>(),
      Map<String, Enum>()
    )
    None
;
`
        }, 2);
        console.log("Validation Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    }
}

main();
