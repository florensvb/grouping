const Grouping = artifacts.require("Grouping");

const truffleCost = require('truffle-cost');

const expectedVotersCount = 12; // ganache allow max 100 accounts

const _seed = 15;
const _groups = 3;
const _votables = 5;

contract("Grouping", async accounts => {

  let grouping;
  const owner = accounts[0];

  it(`should create new instance`, async () => {
    grouping = await Grouping.new({ from: owner });
    assert(grouping);
  });

  it('should declare votables', async() => {
    await truffleCost.log(grouping.declareVotables(_votables));

    const votables = await grouping.votables.call();
    assert.equal(_votables, votables);
  });

  it(`should register ${expectedVotersCount} voters`, async () => {

    await Promise.all(accounts.slice(1, expectedVotersCount + 1).map(account => grouping.registerVoter({ from: account })));

    const votersCount = await grouping.votersCount.call({ from: accounts[0] });

    assert.equal(votersCount.toNumber(), votersCount, `Did not count ${expectedVotersCount} voters`);
  });

  it('should be able to cast a vote', async() => {
    await truffleCost.log(grouping.vote(1, { from: accounts[1] }));

    const vote = await grouping.votes.call(accounts[1]);

    assert.equal(vote, 1);
  });

  it('should be able to use big mod function', async () => {
    const result = await grouping.bigMod(155155155155155, 149, 15, { from: owner });
    assert.equal(result.toNumber(), 10);
  });

  // it('should perform random round robin', async () => {
  //   await truffleCost.log(grouping.randomRoundRobin(_seed, _groups, { from : accounts[0]}));
  // });
  //
  // it('voters and shuffled order should differ', async () => {
  //   let voters = [];
  //   let shuffled = [];
  //
  //   for (let i = 0; i < expectedVotersCount; i++) {
  //     const voter = await grouping.voters.call(i, { from: owner });
  //     const shuffledVoter = await grouping.shuffled.call(i, { from: owner });
  //
  //     voters.push(voter);
  //     shuffled.push(shuffledVoter);
  //   }
  //
  //   console.log(voters);
  //   console.log(shuffled);
  //
  //   assert.notEqual(voters, shuffled);
  // });
});