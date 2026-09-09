/**
 * Real Gateway responses, captured from stokenet. Every account below exists:
 * the verdicts in the tests are what the ledger actually says about them, not
 * what a hand-written fixture was shaped to say.
 */

export const STOKENET_WELL_KNOWN = {
  "account_owner_badge": "resource_tdx_2_1nfxxxxxxxxxxaccwnrxxxxxxxxx006664022062xxxxxxxxx4vczzk",
  "secp256k1_signature_virtual_badge": "resource_tdx_2_1nfxxxxxxxxxxsecpsgxxxxxxxxx004638826440xxxxxxxxxcdcdpa",
  "ed25519_signature_virtual_badge": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
};

/** An account still controlled by its key: the wallet's default state. */
export const KEY_CONTROLLED = {
  address: 'account_tdx_2_12yfm3nu49v4zdyt5u4uc2shw78vxeu3lgjjn0hyk3pmdnfl2qhy7sd',
  ownerRule: {
  "type": "Protected",
  "access_rule": {
    "type": "ProofRule",
    "proof_rule": {
      "type": "Require",
      "requirement": {
        "type": "NonFungible",
        "non_fungible": {
          "local_id": {
            "id_type": "Bytes",
            "sbor_hex": "5cc0021d13b8cf952b2a269174e5798542eef1d86cf23f44a537dc968876d9a7ea",
            "simple_rep": "[13b8cf952b2a269174e5798542eef1d86cf23f44a537dc968876d9a7ea]"
          },
          "resource_address": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
        }
      }
    }
  }
},
};

/** A securified account whose owner badge sits in an Access Controller. */
export const SHIELDED = {
  address: 'account_tdx_2_1cxlkqma97xng7ndd4n5wmcwtfdzzafrke0w7qxlfexzf4y6dl3vc58',
  controller: 'accesscontroller_tdx_2_1cw4p65edm0zm7afznq33cgwv0cv8xw0h5fgpm8ghdjkk624cgeea7l',
  ownerRule: {
  "type": "Protected",
  "access_rule": {
    "type": "ProofRule",
    "proof_rule": {
      "type": "Require",
      "requirement": {
        "type": "NonFungible",
        "non_fungible": {
          "local_id": {
            "id_type": "Bytes",
            "sbor_hex": "5cc0021ec1bf606fa5f1a68f4dadace8ede1cb4b442ea476cbdde01be9c9849a934d",
            "simple_rep": "[c1bf606fa5f1a68f4dadace8ede1cb4b442ea476cbdde01be9c9849a934d]"
          },
          "resource_address": "resource_tdx_2_1nfxxxxxxxxxxaccwnrxxxxxxxxx006664022062xxxxxxxxx4vczzk"
        }
      }
    }
  }
},
};

/** A securified account that kept its own owner badge in its own vault. */
export const SELF_HELD = {
  address: 'account_tdx_2_12y85k44mq77eqhnzst0r0r4qtg37gnqu4h7dw8a4k8lajaf0yk4uay',
  ownerRule: {
  "type": "Protected",
  "access_rule": {
    "type": "ProofRule",
    "proof_rule": {
      "type": "Require",
      "requirement": {
        "type": "NonFungible",
        "non_fungible": {
          "local_id": {
            "id_type": "Bytes",
            "sbor_hex": "5cc0021e510f4b56bb07bd905e6282de378ea05a23e44c1cadfcd71fb5b1ffd9752f",
            "simple_rep": "[510f4b56bb07bd905e6282de378ea05a23e44c1cadfcd71fb5b1ffd9752f]"
          },
          "resource_address": "resource_tdx_2_1nfxxxxxxxxxxaccwnrxxxxxxxxx006664022062xxxxxxxxx4vczzk"
        }
      }
    }
  }
},
};

/** The controller of account_tdx_2_1cxlkqma97…: a 1-of-3 shield with a 1-day delay. */
export const CONTROLLER_DETAILS = {
  "state": {
    "xrd_fee_vault": null,
    "controlled_vault": {
      "is_global": false,
      "entity_type": "InternalNonFungibleVault",
      "entity_address": "internal_vault_tdx_2_1nqflkdy0vmvf32q5f07yzuvrhm0g0umqm290cp0x5lwwzptyt2l6ts"
    },
    "is_primary_role_locked": false,
    "timed_recovery_delay_minutes": 1440,
    "primary_role_recovery_attempt": null,
    "recovery_role_recovery_attempt": null,
    "recovery_badge_resource_address": "resource_tdx_2_1ntue0sgh8zannxg96xp4pr2q7a3prrekatcpkls4ml90fx3que64rt",
    "has_primary_role_badge_withdraw_attempt": false,
    "has_recovery_role_badge_withdraw_attempt": false
  },
  "role_assignments": {
    "entries": [
      {
        "role_key": {
          "module": "Main",
          "name": "primary"
        },
        "assignment": {
          "explicit_rule": {
            "type": "Protected",
            "access_rule": {
              "type": "ProofRule",
              "proof_rule": {
                "list": [
                  {
                    "type": "NonFungible",
                    "non_fungible": {
                      "local_id": {
                        "id_type": "Bytes",
                        "sbor_hex": "5cc0021dd561dfceefe08bf59d0de5d4f915abd7514589525ac91a06468ba13a6c",
                        "simple_rep": "[d561dfceefe08bf59d0de5d4f915abd7514589525ac91a06468ba13a6c]"
                      },
                      "resource_address": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
                    }
                  },
                  {
                    "type": "NonFungible",
                    "non_fungible": {
                      "local_id": {
                        "id_type": "Bytes",
                        "sbor_hex": "5cc0021dd61aee63322efec849b1aed1803c539c6b5866ab584f3ae637172d9cc4",
                        "simple_rep": "[d61aee63322efec849b1aed1803c539c6b5866ab584f3ae637172d9cc4]"
                      },
                      "resource_address": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
                    }
                  },
                  {
                    "type": "NonFungible",
                    "non_fungible": {
                      "local_id": {
                        "id_type": "Bytes",
                        "sbor_hex": "5cc0021d64b54bae339b7daed7c5cb718e6e0cf5cc258610e71362aa26f38ebd1d",
                        "simple_rep": "[64b54bae339b7daed7c5cb718e6e0cf5cc258610e71362aa26f38ebd1d]"
                      },
                      "resource_address": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
                    }
                  }
                ],
                "type": "CountOf",
                "count": 1
              }
            }
          },
          "resolution": "Explicit"
        },
        "updater_roles": [
          {
            "module": "Main",
            "name": "_self_"
          }
        ]
      },
      {
        "role_key": {
          "module": "Main",
          "name": "recovery"
        },
        "assignment": {
          "explicit_rule": {
            "type": "Protected",
            "access_rule": {
              "type": "ProofRule",
              "proof_rule": {
                "list": [
                  {
                    "type": "NonFungible",
                    "non_fungible": {
                      "local_id": {
                        "id_type": "Bytes",
                        "sbor_hex": "5cc0021dd561dfceefe08bf59d0de5d4f915abd7514589525ac91a06468ba13a6c",
                        "simple_rep": "[d561dfceefe08bf59d0de5d4f915abd7514589525ac91a06468ba13a6c]"
                      },
                      "resource_address": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
                    }
                  },
                  {
                    "type": "NonFungible",
                    "non_fungible": {
                      "local_id": {
                        "id_type": "Bytes",
                        "sbor_hex": "5cc0021dd61aee63322efec849b1aed1803c539c6b5866ab584f3ae637172d9cc4",
                        "simple_rep": "[d61aee63322efec849b1aed1803c539c6b5866ab584f3ae637172d9cc4]"
                      },
                      "resource_address": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
                    }
                  },
                  {
                    "type": "NonFungible",
                    "non_fungible": {
                      "local_id": {
                        "id_type": "Bytes",
                        "sbor_hex": "5cc0021d64b54bae339b7daed7c5cb718e6e0cf5cc258610e71362aa26f38ebd1d",
                        "simple_rep": "[64b54bae339b7daed7c5cb718e6e0cf5cc258610e71362aa26f38ebd1d]"
                      },
                      "resource_address": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
                    }
                  }
                ],
                "type": "CountOf",
                "count": 1
              }
            }
          },
          "resolution": "Explicit"
        },
        "updater_roles": [
          {
            "module": "Main",
            "name": "_self_"
          }
        ]
      },
      {
        "role_key": {
          "module": "Main",
          "name": "confirmation"
        },
        "assignment": {
          "explicit_rule": {
            "type": "Protected",
            "access_rule": {
              "type": "ProofRule",
              "proof_rule": {
                "list": [
                  {
                    "type": "NonFungible",
                    "non_fungible": {
                      "local_id": {
                        "id_type": "Bytes",
                        "sbor_hex": "5cc0021dd561dfceefe08bf59d0de5d4f915abd7514589525ac91a06468ba13a6c",
                        "simple_rep": "[d561dfceefe08bf59d0de5d4f915abd7514589525ac91a06468ba13a6c]"
                      },
                      "resource_address": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
                    }
                  },
                  {
                    "type": "NonFungible",
                    "non_fungible": {
                      "local_id": {
                        "id_type": "Bytes",
                        "sbor_hex": "5cc0021dd61aee63322efec849b1aed1803c539c6b5866ab584f3ae637172d9cc4",
                        "simple_rep": "[d61aee63322efec849b1aed1803c539c6b5866ab584f3ae637172d9cc4]"
                      },
                      "resource_address": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
                    }
                  },
                  {
                    "type": "NonFungible",
                    "non_fungible": {
                      "local_id": {
                        "id_type": "Bytes",
                        "sbor_hex": "5cc0021d64b54bae339b7daed7c5cb718e6e0cf5cc258610e71362aa26f38ebd1d",
                        "simple_rep": "[64b54bae339b7daed7c5cb718e6e0cf5cc258610e71362aa26f38ebd1d]"
                      },
                      "resource_address": "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa"
                    }
                  }
                ],
                "type": "CountOf",
                "count": 1
              }
            }
          },
          "resolution": "Explicit"
        },
        "updater_roles": [
          {
            "module": "Main",
            "name": "_self_"
          }
        ]
      }
    ]
  }
};
