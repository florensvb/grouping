const Grouping = artifacts.require("Grouping");

contract("Grouping", accounts => {
  it("should register 100 voters", async () => {
    const grouping = await Grouping.deployed();

    await Promise.all(accounts.map(account => grouping.registerVoter({ from: account })));

    const votersCount = await grouping.votersCount.call({ from: accounts[0] });

    console.log(votersCount.toNumber());

    assert.equal(votersCount.toNumber(), 100, "Did not count 100 voters");
  })
});