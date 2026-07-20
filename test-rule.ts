import { extractRuleAddress } from './features/dashboard/utils/resourceUtils';

const json = {
  "type": "Protected",
  "access_rule": {
    "type": "ProofRule",
    "proof_rule": {
      "type": "Require",
      "requirement": {
        "type": "NonFungible",
        "non_fungible": {
          "local_id": {
            "id_type": "RUID",
            "sbor_hex": "5cc00383e90362cf4b1506f400f9eb6d2e4f5ff9ffd42e2dfdd482b9a9952d66043c61",
            "simple_rep": "{83e90362cf4b1506-f400f9eb6d2e4f5f-f9ffd42e2dfdd482-b9a9952d66043c61}"
          },
          "resource_address": "resource_tdx_2_1nth7zjtujhvmzfpyn9rvu9nexzmye554q6uv7xcchhalsa53r4zqfe"
        }
      }
    }
  }
};

const json2 = {
  "type": "Protected",
  "access_rule": {
    "type": "ProofRule",
    "proof_rule": {
      "type": "Require",
      "requirement": {
        "type": "NonFungible",
        "non_fungible": {
          "local_id": {
            "id_type": "Integer",
            "value": "#1#"
          },
          "resource_address": "resource_tdx_2_1nth7zjtujhvmzfpyn9rvu9nexzmye554q6uv7xcchhalsa53r4zqfe"
        }
      }
    }
  }
};

console.log('Result 1:', extractRuleAddress(json));
console.log('Result 2:', extractRuleAddress(json2));
