const ShuffleAndDistribute = artifacts.require('ShuffleAndRoundRobin');
const SmartDiffieHellman = artifacts.require('SmartDiffieHellman');

const { waitForEvent } = require('./utils');

const truffleCost = require('truffle-cost');
const { utils: { keccak256 } } = require('web3');

const votersCount = 12;
const groups = 3;

let owner, instance;
const commits = {};
const reveals = {};

const seedCommit = [...Array(32)].map(() => parseInt(Math.random() * 256)).toString();
const seedHash = keccak256(seedCommit);

contract('ShuffleAndDistributeInGroups', accounts => {

  it(`needs at least ${votersCount + 1} accounts in Ganache`, async () => {

    owner = accounts[0];
    instance = await ShuffleAndDistribute.deployed();

    assert(accounts.length >= votersCount + 1, `This test case needs at least ${votersCount + 1} accounts (1 owner and ${votersCount} accounts for distribution)`);
  });

  it(`should register ${votersCount} voters`, async () => {
    for(let i = 1; i <= votersCount; i++) {
      await instance.register({ from: accounts[i] });
    }

    for(let i = 0; i < votersCount; i++) {
      assert.equal(await instance.registered.call(i), accounts[i + 1]);
    }
  });

  it('should be able to start the commit phase', async () => {
    await truffleCost.log(instance.startCommitPhase(seedHash));

    const state = await instance.state.call();

    assert.equal(state.toNumber(), 1);
  });

  it('should have a hashed seed stored in contract', async () => {
    const _seedHash = await instance.seedCommit.call();

    assert.equal(_seedHash, seedHash);
  });

  it(`should be able to commit for all ${votersCount} voters`, async () => {
    for(let i = 0; i < votersCount; i++) {
      const address = await instance.registered(i);
      const _commit = [...Array(32)].map(() => parseInt(Math.random() * 256)).toString();
      const hash = keccak256(_commit);

      reveals[address] = _commit;
      commits[address] = hash;

      await truffleCost.log(instance.commit(hash, { from: address }));

      const commit = await instance.commits.call(address);

      assert.equal(commit, hash);
    }
  });

  it('should be able to start the reveal phase', async () => {
    await truffleCost.log(instance.startRevealPhase(seedCommit));

    const state = await instance.state.call();

    assert.equal(state.toNumber(), 2);
  });

  it('should have a revealed seed stored in contract', async () => {
    const seed = await instance.seedReveal.call();

    assert.equal(seed.toString(), seedCommit);
  });

  it (`should be able to reveal all ${votersCount} votes`, async () => {
    for(let i = 0; i < votersCount; i++) {
      const address = await instance.registered(i);

      await truffleCost.log(instance.reveal(reveals[address], { from: address }));

      const reveal = await instance.reveals.call(address);

      assert.equal(reveal, reveals[address]);
    }
  });

  it (`should be able to get a random number from provable`, async () => {
    await truffleCost.log(instance.getProvableRandomNumber({ from : owner }));

    const { contract } = await ShuffleAndDistribute.deployed(),
      { events } = new web3.eth.Contract(
        contract._jsonInterface,
        contract._address
      );

    const {
      returnValues: {
        randomNumber
      }
    } = await waitForEvent(events.LogNewRandomNumber);

    assert.isAbove(
      parseInt(randomNumber),
      0,
      'A random number should have been retrieved from Provable call!'
    );
  });

  it(`should ShuffleAndDistribute these ${votersCount} accounts in ${groups} groups`, async () => {
    await truffleCost.log(instance.distribute(groups, { from: owner }));

    let differentPosition = 0;

    for(let i = 0; i < votersCount; i++) {
      const originalPosition = i;
      const originalAddr = await instance.registered(i);

      let newPosition = -1;

      for(let j = 0; j < votersCount; j++) {
        if(await instance.shuffled(j) === originalAddr)
          newPosition = j;
      }

      assert(newPosition !== -1, 'Missing a registered account in the shuffled accounts: ' + originalPosition);

      if(newPosition !== originalPosition)
        differentPosition++;
    }

    console.log(`${differentPosition} out of ${votersCount} voters have a new position.`);
  });

  it(`should have equally distributed groups`, async () => {

    let groupDistribution = {};

    for (let i = 0; i < groups; i++) {
      groupDistribution[i] = 0;
    }

    for (let i = 1; i < votersCount + 1; i++) {
      const _group = await instance.groups(accounts[i]);

      groupDistribution[_group] = groupDistribution[_group] + 1;
    }

    console.log('Group distribution', groupDistribution);

    for (let i = 0; i < groups; i++) {
      assert(groupDistribution[i] > votersCount / groups - 1 && groupDistribution[i] < votersCount / groups + 1);

      for (let j = 0; j < groups; j++) {
        assert(Math.abs(groupDistribution[i] - groupDistribution[j]) <= 1);
      }
    }
  });

  // number of edges in complete graph: (n/2)(n-1)
  const smartDHXs = [];
  const groupSize = votersCount / groups;
  const smartDHXCountPerGroup = (groupSize / 2) * (groupSize - 1);
  const smartDHXCountTotal = smartDHXCountPerGroup * groups;
  it(`should deploy ${smartDHXCountTotal} smart-dhx contracts`, async () => {
    for (let i = 0; i < smartDHXCountTotal; i++) {
      const smartdxh = await SmartDiffieHellman.new();
      smartDHXs.push(smartdxh);
    }

    for (let i = 0; i < smartDHXCountTotal; i++) {
      assert.ok(smartDHXs[i].address, `Contract ${i} has not been deployed`);

      for(let j = i + 1; j < smartDHXs.length; j++)
        assert.notEqual(smartDHXs[i].address, smartDHXs[j].address, `Contract ${i} and contract ${j} should be different`);
    }
  });

  it('should exchange one and the same key between all pairs of clients', async () => {
    const contract1 = smartDHXs[0];
    const contract2 = smartDHXs[1];

    const seed1 = [...Array(32)].map(() => parseInt(Math.random() * 256));
    const seed2 = [...Array(32)].map(() => parseInt(Math.random() * 256));

    let aA = await contract1.generateA.call(seed1);
    await contract1.transmitA(contract2.address, aA["_A"]);

    assert.ok(aA["_a"], "Missing 'a' in contract 1");
    assert.ok(aA["_A"], "Missing 'A' in contract 1");

    let bB = await contract2.generateA.call(seed2);
    await contract2.transmitA(contract1.address, bB["_A"]);

    assert.ok(bB["_a"], "Missing 'b' in contract 2");
    assert.ok(bB["_A"], "Missing 'B' in contract 2");

    let AB1 = await contract1.generateAB.call(aA["_a"]);
    let AB2 = await contract2.generateAB.call(bB["_a"]);

    assert.equal(AB1.toString(), AB2.toString(), "Exchanged keys keys are not the same");
  });
});