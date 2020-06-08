const ShuffleAndDistribute = artifacts.require('ShuffleAndRoundRobin');
const SmartDiffieHellman = artifacts.require('SmartDiffieHellman');

const { waitForEvent } = require('./utils');

const truffleCost = require('truffle-cost');
const { utils: { keccak256 } } = require('web3');
const CryptoJS = require("crypto-js");

const votersCount = 12;
const groups = 3;

const votingOptions = [0, 1, 2];

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

  it('should set votingOptions', async () => {
    await truffleCost.log(instance.setVotingOptions(votingOptions));

    for (let i = 0; i < votingOptions.length; i++) {
      const votingOption = await instance.votingOptions.call(i);
      assert.equal(votingOptions[i], votingOption, 'voting option does not match');
    }
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

    assert.equal(state.toNumber(), 2);
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

    assert.equal(state.toNumber(), 3);
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

    const numberOfGroups = await instance.numberOfGroups.call();
    assert.equal(numberOfGroups, groups);

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

  // number of edges in complete graph: n * (n - 1)
  const groupSize = votersCount / groups;
  const smartDHXCountPerGroup = groupSize * (groupSize - 1);
  const smartDHXCountTotal = smartDHXCountPerGroup * groups;

  const smartDHXs = [];

  it(`should deploy ${smartDHXCountTotal} smartDHX contracts`, async () => {
    const votersInGroups = {};

    for (let i = 1; i <= votersCount; i++) {
      const group = await instance.groups(accounts[i]);
      votersInGroups[group] ? votersInGroups[group].push(accounts[i]) : votersInGroups[group] = [accounts[i]];
    }

    let smartDHXCount = 0;

    for (const key of Object.keys(votersInGroups)) {
      const votersInGroup = votersInGroups[key];

      for (let i = 0; i < votersInGroup.length -1; i++) {
        for (let j = i + 1; j < votersInGroup.length; j++) {
          assert.notEqual(votersInGroup[i], votersInGroup[j], 'The two voters are the same');

          await truffleCost.log(instance.deploySmartDHX(votersInGroup[i], votersInGroup[j]));

          const firstEdgeKey = await instance.getEdgeKey(votersInGroup[i], votersInGroup[j]);
          const secondEdgeKey = await instance.getEdgeKey(votersInGroup[j], votersInGroup[i]);

          assert.notEqual(firstEdgeKey, secondEdgeKey, 'The two edgeKeys are the same');

          const firstSmartDHX = await instance.smartDHXs(firstEdgeKey);
          const secondSmartDHX = await instance.smartDHXs(secondEdgeKey);

          assert.ok(firstSmartDHX, `SmartDHX between ${votersInGroups[i]} and ${votersInGroups[j]} has not been deployed`);
          assert.ok(secondSmartDHX, `SmartDHX between ${votersInGroups[j]} and ${votersInGroups[i]} has not been deployed`);
          assert.notEqual(firstSmartDHX, secondSmartDHX, 'The two smartDHX are the same');

          smartDHXs.push({ key: firstEdgeKey, i: votersInGroup[i], j: votersInGroup[j]});
          smartDHXs.push({ key: secondEdgeKey, i: votersInGroup[j], j: votersInGroup[i]});

          smartDHXCount += 2;
        }
      }
    }

    assert.equal(smartDHXCount, smartDHXCountTotal, `Not all ${smartDHXCountTotal} smartDHXs have been deployed`);
  });

  const pairsOfClients = [];
  it('should exchange one and the same key between all pairs of clients', async () => {
    const abi = require('./../build/contracts/SmartDiffieHellman').abi;

    for (let i = 0; i < smartDHXs.length; i += 2) {
      const first = smartDHXs[i];
      const second = smartDHXs[i + 1];
      const firstSmartDHXaddress = await instance.smartDHXs(first.key);
      const secondSmartDHXaddress = await instance.smartDHXs(second.key);

      const firstSmartDHX = new web3.eth.Contract(abi, firstSmartDHXaddress, {from: first.i});
      const secondSmartDHX = new web3.eth.Contract(abi, secondSmartDHXaddress, {from: second.i});

      const seed1 = [...Array(32)].map(() => parseInt(Math.random() * 256));
      const seed2 = [...Array(32)].map(() => parseInt(Math.random() * 256));

      let aA = await firstSmartDHX.methods.generateA(seed1).call();
      await firstSmartDHX.methods.transmitA(secondSmartDHXaddress, aA["_A"]).send();

      assert.ok(aA["_a"], "Missing 'a' in contract 1");
      assert.ok(aA["_A"], "Missing 'A' in contract 1");

      let bB = await secondSmartDHX.methods.generateA(seed2).call();
      await secondSmartDHX.methods.transmitA(firstSmartDHXaddress, bB["_A"]).send();

      assert.ok(bB["_a"], "Missing 'b' in contract 2");
      assert.ok(bB["_A"], "Missing 'B' in contract 2");

      let AB1 = await firstSmartDHX.methods.generateAB(aA["_a"]).call();
      let AB2 = await secondSmartDHX.methods.generateAB(bB["_a"]).call();

      assert.equal(AB1.toString(), AB2.toString(), "Exchanged keys keys are not the same");

      pairsOfClients.push({first: first.i, second: second.i, secret: AB1.toString()});
    }
  });

  const votes = accounts.reduce((acc, account) => {
    acc[account] = votingOptions[Math.floor(Math.random() * votingOptions.length)];
    return acc;
  }, {});

  it('should share votes between each pair of clients in an encrypted manner', async () => {
    for (const pair of pairsOfClients) {
      const firstVote = votes[pair.first];
      const secondVote = votes[pair.second];

      const firstCiphertext = CryptoJS.AES.encrypt(firstVote.toString(), pair.secret.toString()).toString();
      const secondCiphertext = CryptoJS.AES.encrypt(secondVote.toString(), pair.secret.toString()).toString();

      await truffleCost.log(instance.sendVote(firstCiphertext, pair.second, {from: pair.first}));
      await truffleCost.log(instance.sendVote(secondCiphertext, pair.first, {from: pair.second}));

      assert.equal(await instance.votes(pair.first, pair.second), firstCiphertext, 'Vote stored in contract does not match ciphertext');
      assert.equal(await instance.votes(pair.second, pair.first), secondCiphertext, 'Vote stored in contract does not match ciphertext');
    }
  });

  const groupTotals = accounts.reduce((acc, account) => {
    acc[account] = new Array(votingOptions.length).fill(0);
    return acc;
  }, {});

  it('should decrypt and broadcast group totals', async () => {

    for (const pair of pairsOfClients) {
      const firstCiphertext = await instance.votes(pair.first, pair.second);
      const secondCiphertext = await instance.votes(pair.second, pair.first);

      const firstVoteBytes = CryptoJS.AES.decrypt(firstCiphertext, pair.secret);
      const secondVoteBytes = CryptoJS.AES.decrypt(secondCiphertext, pair.secret);

      const firstVote = firstVoteBytes.toString(CryptoJS.enc.Utf8);
      const secondVote = secondVoteBytes.toString(CryptoJS.enc.Utf8);

      assert.equal(firstVote, votes[pair.first], "Decrypted vote does not equal initial vote");
      assert.equal(secondVote, votes[pair.second], "Decrypted vote does not equal initial vote");

      groupTotals[pair.first][parseInt(secondVote)] += 1;
      groupTotals[pair.second][parseInt(firstVote)] += 1;
    }

    for(let i = 0; i < votersCount; i++) {
      const address = await instance.registered(i);
      groupTotals[address][votes[address]] += 1;
      await truffleCost.log(instance.broadcastGroupTotalVotes(groupTotals[address], {from: address}));

      for (let j = 0; j < votingOptions; j++) {
        const broadcastedTotal = await instance.groupTotals(address, j);
        assert.equal(broadcastedTotal, groupTotals[address][j], "Broadcasted totals do not match");
      }
    }
  });

  it('should determine the winner', async () => {
    const totals = Object.keys(groupTotals).reduce((acc, key) => {
      for (let i = 0; i < groupTotals[key].length; i++) {
        acc[i] += groupTotals[key][i];
      }
      return acc;
    }, new Array(votingOptions.length).fill(0));

    const winner = totals.indexOf(Math.max.apply(Math, totals));

    await truffleCost.log(instance.calculateTotals());

    let _totals = new Array(votingOptions.length).fill(0);
    for (let i = 0; i < votersCount; i++) {
      for (let j = 0; j < votingOptions.length; j++) {
        const groupTotal = await instance.groupTotals(accounts[i + 1], j);
        _totals[j] += parseInt(groupTotal);
      }
    }

    const _winner = _totals.indexOf(Math.max.apply(Math, _totals));

    assert.equal(winner, _winner, 'Winner does not match');
  });
});