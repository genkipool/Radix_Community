-- scripts/olympia/build-stake-history-index.sql
-- Run with DuckDB in a folder holding the dataset's raw tables; writes the two
-- index files published under index/ in the dataset.
-- Two lookup files for the stake an Olympia account had at any state version.
-- Input: the dataset's raw tables (account_validator_stake_history,
-- validator_stake_history, validators). Rows cover [from_state_version,
-- to_state_version] inclusive; an open row (still current when Olympia ended)
-- gets to_state_version = 337759839, the last state version.
-- XRD staked at version V = total_stake_units * validator total_xrd_staked /
-- (validator total_stake_units + total_prepared_unstake_units), both rows
-- covering V; units being unstaked are valued the same way.
COPY (
  SELECT a.account_id, a.validator_id, v.address AS validator_address,
         a.from_state_version, COALESCE(a.to_state_version, 337759839) AS to_state_version,
         a.total_stake_units, a.total_prepared_xrd_stake, a.total_prepared_unstake_units, a.total_exiting_xrd_stake
  FROM 'account_validator_stake_history.parquet' a
  JOIN 'validators.parquet' v ON v.id = a.validator_id
  ORDER BY a.account_id, a.from_state_version, a.validator_id
) TO 'index/account_stake_history.parquet' (FORMAT parquet, COMPRESSION zstd, ROW_GROUP_SIZE 16384);

COPY (
  SELECT validator_id, from_state_version, COALESCE(to_state_version, 337759839) AS to_state_version,
         total_xrd_staked, total_stake_units, total_prepared_unstake_units
  FROM 'validator_stake_history.parquet'
  ORDER BY validator_id, from_state_version
) TO 'index/validator_stake_history.parquet' (FORMAT parquet, COMPRESSION zstd, ROW_GROUP_SIZE 16384);
