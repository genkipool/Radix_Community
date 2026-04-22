function resolveProposerInfoFromGatewayItem(item) {
    let fd = item.receipt?.fee_destination;
    if (!fd && item.receipt?.fee_summary) fd = item.receipt.fee_summary;
    if (!fd) return undefined;

    const toProposerRaw = fd.to_proposer || fd.toProposer; // Handle camelcase just in case
    const toProposerAmtStr = typeof toProposerRaw === 'string'
        ? toProposerRaw
        : toProposerRaw?.xrd_amount;

    if (!toProposerAmtStr || toProposerAmtStr === '0') return undefined;
    const targetDelta = parseFloat(toProposerAmtStr);

    let substates = item.receipt?.state_updates?.updated_substates;
    if (!substates) substates = item.receipt?.state_updates?.updated;

    if (!substates || !Array.isArray(substates)) return undefined;

    let newRewards = [];
    let previousRewards = [];

    for (const entry of substates) {
        let nr = entry?.new_value?.substate_data?.value?.proposer_rewards;
        if (!nr) nr = entry?.new_value?.proposer_rewards;

        if (Array.isArray(nr) && nr.length > 0) {
            newRewards = nr;
            let pr = entry?.previous_value?.substate_data?.value?.proposer_rewards;
            if (!pr) pr = entry?.previous_value?.proposer_rewards;
            previousRewards = pr ?? [];
            break;
        }
    }

    if (newRewards.length === 0) return undefined;

    for (let i = 0; i < newRewards.length; i++) {
        const nr = newRewards[i];
        const pr = previousRewards[i];

        const newAmt = parseFloat(nr.xrd_amount);
        const prevAmt = pr ? parseFloat(pr.xrd_amount) : 0;
        const delta = newAmt - prevAmt;

        if (Math.abs(delta - targetDelta) < 0.000000000001) {
            return {
                validatorIndex: nr.validator_index.index,
                rank: nr.validator_index.index + 1,
                rewardAmount: targetDelta.toString(),
            };
        }
    }

    return undefined;
}

const mockItem = {
  receipt: {
    fee_destination: { "to_burn":"0.358532695895","to_proposer":"0.1792663479475","to_validator_set":"0.1792663479475","to_royalty_recipients":[] },
    state_updates: {
      updated_substates: [
        {
          new_value: { proposer_rewards: [{"xrd_amount":"0.1792663479475","validator_index":{"index":0}}] }
        }
      ]
    }
  }
};

console.log("Mock extraction:", resolveProposerInfoFromGatewayItem(mockItem));
