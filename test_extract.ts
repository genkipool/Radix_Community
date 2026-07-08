import { extractRuleAddress } from './features/dashboard/utils/resourceUtils';

const mockRule = {
    "type": "Protected",
    "access_rule": {
        "type": "ProofRule",
        "proof_rule": {
            "type": "Require",
            "requirement": {
                "type": "NonFungible",
                "non_fungible": {
                    "resource_address": "resource_tdx_2_1n2h47yfg7yjzp97d4jjkd43xg7pgs86w89v30sxs5ynkl6amgrxts9",
                    "local_id": {
                        "value": "#1#"
                    }
                }
            }
        }
    }
};

console.log(extractRuleAddress(mockRule));
