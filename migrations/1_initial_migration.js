const Migrations = artifacts.require("Migrations");
const ShuffleAndRoundRobin = artifacts.require("ShuffleAndRoundRobin");

module.exports = function(deployer) {
  deployer.deploy(Migrations);
  deployer.deploy(ShuffleAndRoundRobin);
};
