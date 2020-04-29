const {
  PREFIX,
  waitForEvent
} = require('./utils')

const ShuffleAndDistribute = artifacts.require('ShuffleAndRoundRobin');

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:7545'))

contract('provableAPI: Get random number', accounts => {

  let contractRandomNumber
  const gasAmt = 3e6
  const address = accounts[0]

  beforeEach(async () => (
    { contract } = await ShuffleAndDistribute.deployed(),
      { methods, events } = new web3.eth.Contract(
        contract._jsonInterface,
        contract._address
      )
  ))

  it('Should have logged a new Provable query', async () => {
    await methods
      .getProvableRandomNumber()
      .send({
        from: address,
        gas: gasAmt
      })

    const {
      returnValues: {
        description
      }
    } = await waitForEvent(events.LogNewProvableQuery)
    assert.strictEqual(
      description,
      'Provable query was sent, standing by for the answer...',
      'Provable query incorrectly logged!'
    )
  })

  it('Callback should have logged a new random number', async () => {
    const {
      returnValues: {
        randomNumber
      }
    } = await waitForEvent(events.LogNewRandomNumber)
    contractRandomNumber = randomNumber
    assert.isAbove(
      parseInt(randomNumber),
      0,
      'A random number should have been retrieved from Provable call!'
    )
  })

  it('Should set random number correctly in contract', async () => {
    const queriedRandomNumber = await methods
      .provableRandomNumber()
      .call()
    assert.strictEqual(
      parseInt(contractRandomNumber),
      parseInt(queriedRandomNumber),
      'Contract\'s random number not set correctly!'
    )
  })

  it('Should revert on second query attempt due to lack of funds', async () => {
    const expErr = 'revert'
    try {
      await methods
        .getProvableRandomNumber()
        .send({
          from: address,
          gas: gasAmt
        })
      assert.fail('Update transaction should not have succeeded!')
    } catch (e) {
      assert.isTrue(
        e.message.startsWith(`${PREFIX}${expErr}`),
        `Expected ${expErr} but got ${e.message} instead!`
      )
    }
  })
});