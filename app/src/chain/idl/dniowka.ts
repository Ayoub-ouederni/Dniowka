/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/dniowka.json`.
 */
export type Dniowka = {
  "address": "EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3",
  "metadata": {
    "name": "dniowka",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Salary vault: earned wages withdrawable anytime, payday settles itself"
  },
  "instructions": [
    {
      "name": "acceptAdjustment",
      "docs": [
        "The employee consents to exactly the adjustment they reviewed."
      ],
      "discriminator": [
        13,
        224,
        98,
        47,
        168,
        134,
        195,
        128
      ],
      "accounts": [
        {
          "name": "employee",
          "signer": true
        },
        {
          "name": "stream",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "acceptStream",
      "docs": [
        "The employee joins; from now on only they can withdraw."
      ],
      "discriminator": [
        103,
        150,
        130,
        111,
        186,
        78,
        166,
        62
      ],
      "accounts": [
        {
          "name": "employee",
          "signer": true
        },
        {
          "name": "stream",
          "writable": true
        },
        {
          "name": "employer",
          "relations": [
            "stream"
          ]
        }
      ],
      "args": [
        {
          "name": "incomeCommitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "cancelUnaccepted",
      "docs": [
        "The employer takes back the funding of an invite nobody accepted."
      ],
      "discriminator": [
        165,
        153,
        32,
        101,
        199,
        134,
        68,
        50
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The employer; also pays rent if their refund account does not exist."
          ],
          "writable": true,
          "signer": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "employer",
          "relations": [
            "stream"
          ]
        },
        {
          "name": "stream",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "stream"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "stream"
          ]
        },
        {
          "name": "employerToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "memoProgram",
          "address": "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createStream",
      "docs": [
        "Opens one employee's salary for one pay period and creates its vault."
      ],
      "discriminator": [
        71,
        188,
        111,
        127,
        108,
        40,
        229,
        158
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Pays rent only."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "employer",
          "writable": true
        },
        {
          "name": "stream",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "employer"
              },
              {
                "kind": "account",
                "path": "employer.streamCount",
                "account": "employer"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "stream"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "employer"
          ]
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "employeeHint",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "netAmount",
          "type": "u64"
        },
        {
          "name": "periodStart",
          "type": "i64"
        },
        {
          "name": "periodEnd",
          "type": "i64"
        },
        {
          "name": "payday",
          "type": "i64"
        },
        {
          "name": "floorBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "endEmployment",
      "docs": [
        "The employer ends employment, never in the past."
      ],
      "discriminator": [
        119,
        120,
        31,
        235,
        37,
        58,
        191,
        229
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "employer",
          "relations": [
            "stream"
          ]
        },
        {
          "name": "stream",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "endTs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "fundStream",
      "docs": [
        "The employer locks salary into the vault."
      ],
      "discriminator": [
        152,
        2,
        247,
        241,
        52,
        8,
        160,
        223
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "employer",
          "relations": [
            "stream"
          ]
        },
        {
          "name": "stream",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "stream"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "stream"
          ]
        },
        {
          "name": "source",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initEmployer",
      "docs": [
        "Registers a company and the zł token it pays in."
      ],
      "discriminator": [
        121,
        170,
        27,
        63,
        196,
        74,
        134,
        195
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Pays rent only."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "employer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "defaultFloorBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "proposeAdjustment",
      "docs": [
        "The employer proposes a reduction of the final pay (sick leave, absence, correction).",
        "Without the employee's consent it can never cut below the floor."
      ],
      "discriminator": [
        90,
        186,
        188,
        58,
        49,
        89,
        216,
        219
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "employer",
          "relations": [
            "stream"
          ]
        },
        {
          "name": "stream",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "reason",
          "type": "u8"
        }
      ]
    },
    {
      "name": "settle",
      "docs": [
        "Payday: anyone can trigger it; the program pays the employee and refunds the rest."
      ],
      "discriminator": [
        175,
        42,
        185,
        87,
        144,
        131,
        102,
        212
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Whoever triggers payday; pays rent for any missing payout account."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "stream",
          "writable": true
        },
        {
          "name": "employer",
          "relations": [
            "stream"
          ]
        },
        {
          "name": "employee"
        },
        {
          "name": "employerAuthority"
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "stream"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "stream"
          ]
        },
        {
          "name": "employeeToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "employee"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "employerToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "employerAuthority"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "memoProgram",
          "address": "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdrawEarned",
      "docs": [
        "The employee takes part of what they have already earned. No lender, no approval."
      ],
      "discriminator": [
        231,
        255,
        26,
        76,
        28,
        120,
        137,
        111
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Pays rent for the employee's token account if it does not exist yet."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "employee",
          "signer": true
        },
        {
          "name": "stream",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "stream"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "stream"
          ]
        },
        {
          "name": "destination",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "employee"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "employer",
      "discriminator": [
        34,
        80,
        59,
        57,
        83,
        119,
        213,
        106
      ]
    },
    {
      "name": "stream",
      "discriminator": [
        166,
        224,
        59,
        4,
        202,
        10,
        186,
        83
      ]
    }
  ],
  "events": [
    {
      "name": "adjustmentAccepted",
      "discriminator": [
        96,
        155,
        252,
        39,
        244,
        248,
        154,
        70
      ]
    },
    {
      "name": "adjustmentProposed",
      "discriminator": [
        179,
        246,
        172,
        117,
        138,
        151,
        81,
        38
      ]
    },
    {
      "name": "employmentEnded",
      "discriminator": [
        130,
        131,
        9,
        107,
        30,
        104,
        177,
        238
      ]
    },
    {
      "name": "funded",
      "discriminator": [
        67,
        84,
        56,
        88,
        192,
        12,
        201,
        177
      ]
    },
    {
      "name": "settled",
      "discriminator": [
        232,
        210,
        40,
        17,
        142,
        124,
        145,
        238
      ]
    },
    {
      "name": "streamAccepted",
      "discriminator": [
        23,
        144,
        144,
        204,
        164,
        126,
        10,
        140
      ]
    },
    {
      "name": "streamCancelled",
      "discriminator": [
        91,
        215,
        29,
        237,
        194,
        6,
        184,
        92
      ]
    },
    {
      "name": "streamCreated",
      "discriminator": [
        93,
        150,
        91,
        15,
        166,
        8,
        251,
        166
      ]
    },
    {
      "name": "wageShortfall",
      "discriminator": [
        13,
        137,
        89,
        127,
        134,
        19,
        127,
        17
      ]
    },
    {
      "name": "withdrawn",
      "discriminator": [
        20,
        89,
        223,
        198,
        194,
        124,
        219,
        13
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "exceedsAvailable",
      "msg": "Amount is more than is available now"
    },
    {
      "code": 6001,
      "name": "paymentLocked",
      "msg": "This salary is secured. Nobody can take it back"
    },
    {
      "code": 6002,
      "name": "notEmployer",
      "msg": "Only the employer can do this"
    },
    {
      "code": 6003,
      "name": "backdatingNotAllowed",
      "msg": "End date can't be in the past"
    },
    {
      "code": 6004,
      "name": "tooEarlyForPayday",
      "msg": "Payday has not come yet"
    },
    {
      "code": 6005,
      "name": "overfunded",
      "msg": "Funding would exceed the net salary"
    },
    {
      "code": 6006,
      "name": "invalidPeriod",
      "msg": "Period end must be after period start"
    },
    {
      "code": 6007,
      "name": "invalidFloor",
      "msg": "Floor must be between 1 and 10000 basis points"
    },
    {
      "code": 6008,
      "name": "alreadySettled",
      "msg": "This salary has already been paid out"
    },
    {
      "code": 6009,
      "name": "notEmployee",
      "msg": "Only the employee can do this"
    },
    {
      "code": 6010,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6011,
      "name": "proofInvalid",
      "msg": "Income proof is invalid"
    },
    {
      "code": 6012,
      "name": "unknownRoot",
      "msg": "Unknown income registry root"
    },
    {
      "code": 6013,
      "name": "invalidPayday",
      "msg": "Payday must be between period end and 10 days after it"
    },
    {
      "code": 6014,
      "name": "notInvited",
      "msg": "This invite has already been accepted"
    },
    {
      "code": 6015,
      "name": "notActive",
      "msg": "This salary is not active"
    },
    {
      "code": 6016,
      "name": "invalidEndDate",
      "msg": "End date can't be after the period end"
    },
    {
      "code": 6017,
      "name": "endDateCannotMoveEarlier",
      "msg": "End date can only be moved later"
    },
    {
      "code": 6018,
      "name": "fundingClosed",
      "msg": "Funding is closed after payday"
    },
    {
      "code": 6019,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6020,
      "name": "unsupportedMint",
      "msg": "Salary token must be a plain Token-2022 mint without freeze authority or extensions"
    },
    {
      "code": 6021,
      "name": "employerCannotBeEmployee",
      "msg": "An employer can't be their own employee"
    },
    {
      "code": 6022,
      "name": "invalidAdjustmentReason",
      "msg": "Adjustment reason must be 1 (sick leave), 2 (unpaid absence), 3 (correction) or 4 (other)"
    },
    {
      "code": 6023,
      "name": "adjustmentTooLarge",
      "msg": "Adjustment would cut into pay that was already taken"
    },
    {
      "code": 6024,
      "name": "adjustmentClosed",
      "msg": "Adjustments close at payday"
    },
    {
      "code": 6025,
      "name": "noAdjustment",
      "msg": "There is no adjustment to accept"
    },
    {
      "code": 6026,
      "name": "adjustmentChanged",
      "msg": "The adjustment changed; review it again"
    },
    {
      "code": 6027,
      "name": "cancelTooEarly",
      "msg": "This invite can't be cancelled yet"
    }
  ],
  "types": [
    {
      "name": "adjustmentAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stream",
            "type": "pubkey"
          },
          {
            "name": "employee",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "adjustmentProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stream",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reason",
            "type": "u8"
          },
          {
            "name": "capWithoutConsent",
            "docs": [
              "Most that applies without the employee's consent (down to the floor)."
            ],
            "type": "u64"
          },
          {
            "name": "capWithConsent",
            "docs": [
              "Most that applies with consent (down to what was already taken)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "employer",
      "docs": [
        "A company that pays salaries through Dniówka. Seeds: [\"employer\", authority]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "docs": [
              "The zł token every stream of this employer is paid in."
            ],
            "type": "pubkey"
          },
          {
            "name": "defaultFloorBps",
            "docs": [
              "Suggested floor for new streams (UI default; each stream stores its own)."
            ],
            "type": "u16"
          },
          {
            "name": "streamCount",
            "docs": [
              "Next stream id, used in the stream PDA seeds."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "employmentEnded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stream",
            "type": "pubkey"
          },
          {
            "name": "endTs",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "funded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stream",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "funded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "settled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stream",
            "type": "pubkey"
          },
          {
            "name": "payEmployee",
            "type": "u64"
          },
          {
            "name": "refundEmp",
            "type": "u64"
          },
          {
            "name": "shortfall",
            "type": "u64"
          },
          {
            "name": "earnedFinal",
            "type": "u64"
          },
          {
            "name": "cut",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "stream",
      "docs": [
        "One employee × one pay period. Seeds: [\"stream\", employer, id_le_bytes].",
        "Its vault is the token account at [\"vault\", stream], owned by this PDA."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "employer",
            "docs": [
              "Employer PDA."
            ],
            "type": "pubkey"
          },
          {
            "name": "employee",
            "docs": [
              "While `Invited`: the invite hint (`Pubkey::default()` = open invite).",
              "From `Active` on: the employee who accepted."
            ],
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "netAmount",
            "docs": [
              "Net salary for the period, in grosze."
            ],
            "type": "u64"
          },
          {
            "name": "periodStart",
            "type": "i64"
          },
          {
            "name": "periodEnd",
            "type": "i64"
          },
          {
            "name": "payday",
            "type": "i64"
          },
          {
            "name": "floorBps",
            "docs": [
              "Guaranteed share of earned pay, 1..=10_000 basis points."
            ],
            "type": "u16"
          },
          {
            "name": "funded",
            "docs": [
              "Total deposited by the employer (never above `net_amount`)."
            ],
            "type": "u64"
          },
          {
            "name": "withdrawn",
            "docs": [
              "Total already advanced to the employee."
            ],
            "type": "u64"
          },
          {
            "name": "endTs",
            "docs": [
              "Employment end, set by the employer; never in the past, only ever moved later."
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "adjustment",
            "docs": [
              "Proposed reduction of the final pay (M3)."
            ],
            "type": "u64"
          },
          {
            "name": "adjustmentReason",
            "type": "u8"
          },
          {
            "name": "adjustmentAccepted",
            "type": "bool"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "streamStatus"
              }
            }
          },
          {
            "name": "incomeCommitment",
            "docs": [
              "ZK leaf commitment given by the employee on accept (M6)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "streamAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stream",
            "type": "pubkey"
          },
          {
            "name": "employee",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "streamCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stream",
            "type": "pubkey"
          },
          {
            "name": "refundEmp",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "streamCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stream",
            "type": "pubkey"
          },
          {
            "name": "employer",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "employeeHint",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "netAmount",
            "type": "u64"
          },
          {
            "name": "periodStart",
            "type": "i64"
          },
          {
            "name": "periodEnd",
            "type": "i64"
          },
          {
            "name": "payday",
            "type": "i64"
          },
          {
            "name": "floorBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "streamStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "invited"
          },
          {
            "name": "active"
          },
          {
            "name": "settled"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "wageShortfall",
      "docs": [
        "Public record that the employer under-funded what the employee earned."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stream",
            "type": "pubkey"
          },
          {
            "name": "employer",
            "type": "pubkey"
          },
          {
            "name": "employee",
            "type": "pubkey"
          },
          {
            "name": "shortfall",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "withdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stream",
            "type": "pubkey"
          },
          {
            "name": "employee",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "withdrawn",
            "type": "u64"
          },
          {
            "name": "earned",
            "type": "u64"
          },
          {
            "name": "availableAfter",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "employerSeed",
      "type": "bytes",
      "value": "[101, 109, 112, 108, 111, 121, 101, 114]"
    },
    {
      "name": "maxPaydayDelay",
      "docs": [
        "Payday may fall at most this long after the period ends (Labour Code art. 85: up to the 10th)."
      ],
      "type": "i64",
      "value": "864000"
    },
    {
      "name": "streamSeed",
      "type": "bytes",
      "value": "[115, 116, 114, 101, 97, 109]"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    }
  ]
};
