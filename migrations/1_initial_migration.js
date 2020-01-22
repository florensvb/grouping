const Migrations = artifacts.require("Migrations");
const Grouping = artifacts.require("Grouping");

module.exports = function(deployer) {
  deployer.deploy(Migrations);
  deployer.deploy(Grouping);
};
