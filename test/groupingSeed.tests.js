const GroupingSeed = artifacts.require("GroupingSeed");

const truffleCost = require('truffle-cost');

const expectedVotersCount = 12; // ganache allow max 100 accounts

const _seed = 15;
const _groups = 3;
const _votables = 5;

const commitValue = `3_supersecret`;

contract("GroupingSeed", async accounts => {

  let groupingSeed;
  const owner = accounts[0];

  it(`should create new instance`, async () => {
    groupingSeed = await GroupingSeed.new({ from: owner });
    assert(groupingSeed);
  });

  it(`should declare that there are ${_votables} options`, async() => {
    await truffleCost.log(groupingSeed.declareVotables(_votables));

    const votables = await groupingSeed.votables.call();

    assert.equal(_votables, votables);
  });

  it(`should register ${expectedVotersCount} voters`, async () => {

    await Promise.all(accounts.slice(1, expectedVotersCount + 1).map(account => groupingSeed.registerVoter({ from: account })));

    const votersCount = await groupingSeed.getVoterCount.call({ from: owner });

    assert.equal(votersCount.toNumber(), votersCount, `Did not count ${expectedVotersCount} voters`);
  });

  it(`should distribute ${expectedVotersCount} accounts in ${_groups} groups`, async () => {
    const secretSeed = 849026103;

    await truffleCost.log(groupingSeed.distribute(secretSeed, _groups, {from: owner}));

    let groupDistribution = {};

    for (let i = 0; i < _groups; i++) {
      groupDistribution[i] = 0;
    }

    for(let i = 0; i < expectedVotersCount; i++) {
      const address = await groupingSeed.addresses.call(i);
      const group = (await groupingSeed.groups.call(address)).toNumber();

      assert.isNotNull(group);
      assert.isBelow(group, _groups);

      groupDistribution[group] = groupDistribution[group] + 1;
    }

    console.log(groupDistribution);

    for (let i = 0; i < _groups; i++) {
      assert.equal(groupDistribution[i], expectedVotersCount / _groups);
    }
  });
});