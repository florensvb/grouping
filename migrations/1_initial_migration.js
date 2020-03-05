const Migrations = artifacts.require("Migrations");
const Grouping = artifacts.require("Grouping");
const GroupingSeed = artifacts.require("GroupingSeed");

module.exports = function(deployer) {
  deployer.deploy(Migrations);
  deployer.deploy(Grouping);
  deployer.deploy(GroupingSeed);
};
