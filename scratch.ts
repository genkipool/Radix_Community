import { RadixEngineToolkit } from "@radixdlt/radix-engine-toolkit";

async function main() {
  const instr = {
    kind: "String",
    value: `
CALL_METHOD Address("account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw") "lock_fee" Decimal("1");
CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    None
    Enum<1u8>()
    true
    Enum<0u8>(
      Enum<0u8>(
          Tuple(
              Array<Enum>(
                  Enum<14u8>(
                      Array<Enum>(
                          Enum<0u8>(12u8),
                          Enum<0u8>(12u8),
                          Enum<0u8>(198u8)
                      )
                  )
              ),
              Array<Tuple>(
                  Tuple(
                      Enum<1u8>("DataSchema"),
                      Enum<1u8>(
                          Enum<0u8>(
                              Array<String>("name", "description", "key_image_url")
                          )
                      )
                  )
              ),
              Array<Enum>(Enum<0u8>())
          )
      ),
      Enum<1u8>(0u64),
      Array<String>()
    )
    Map<NonFungibleLocalId, Tuple>(
      NonFungibleLocalId("#0#") => Tuple(
        Tuple("Hero 1", "Desc 1", Url("https://img.com/1"))
      )
    )
    Tuple(
      Some(Tuple(Some(Enum<AccessRule::DenyAll>()), Some(Enum<AccessRule::DenyAll>()))),
      Some(Tuple(Some(Enum<AccessRule::DenyAll>()), Some(Enum<AccessRule::DenyAll>()))),
      Some(Tuple(Some(Enum<AccessRule::DenyAll>()), Some(Enum<AccessRule::DenyAll>()))),
      Some(Tuple(Some(Enum<AccessRule::DenyAll>()), Some(Enum<AccessRule::DenyAll>()))),
      Some(Tuple(Some(Enum<AccessRule::AllowAll>()), Some(Enum<AccessRule::DenyAll>()))),
      Some(Tuple(Some(Enum<AccessRule::AllowAll>()), Some(Enum<AccessRule::DenyAll>()))),
      Some(Tuple(None, Some(Enum<AccessRule::DenyAll>())))
    )
    Tuple(Map<String, Tuple>(), Map<String, Enum>("metadata_setter" => None, "metadata_setter_updater" => None, "metadata_locker" => None, "metadata_locker_updater" => None))
    Enum<0u8>()
;
`
  };
  
  try {
    const result = await RadixEngineToolkit.Instructions.staticallyValidate(instr as any, 1);
    console.log(result);
  } catch(e) {
    console.error(e);
  }
}
main();
