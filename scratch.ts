import { RadixEngineToolkit } from "@radixdlt/radix-engine-toolkit";

async function main() {
  const schema = await RadixEngineToolkit.Build.sborString({
    kind: "Tuple",
    fields: [
      {
        kind: "String",
        value: "Hello"
      }
    ]
  });
  console.log(schema);
}
main();
