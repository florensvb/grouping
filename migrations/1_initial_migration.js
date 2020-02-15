const Migrations = artifacts.require("Migrations");
const Grouping = artifacts.require("Grouping");

module.exports = function(deployer) {
  deployer.deploy(Migrations);
  // deployer.deploy(Grouping, ["0x6265726e696573616e64657273", "0x646f6e616c647472756d70"]); // proposal_1, proposal_2 in hex
  deployer.deploy(Grouping); // proposal_1, proposal_2 in hex
};
