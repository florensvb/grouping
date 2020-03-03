pragma solidity >=0.4.22 <0.7.0;

contract Grouping {
    // Init
    address owner;

    mapping(address => bool) public registered;
    mapping(uint256 => address) public voters;
    mapping(address => uint256) public votes;
    mapping(uint256 => address) public shuffled;
    mapping(address => uint256) public groups;
    mapping(address => bytes32) public commits;
    mapping(address => string) public reveals;

    uint256 public votables;
    uint256 public votersCount = 0;
    bool public commitPhase = false;
    bool public revealPhase = false;

    constructor() public {
        owner = msg.sender;
    }

    function declareVotables(uint256 _votables) public {
        require(msg.sender == owner);
        votables = _votables;
    }

    // Voter registration
    function registerVoter() public {
        require(!registered[msg.sender], "Voter already registered.");
        require(votersCount < 2**256 - 1, "Overflow!");

        registered[msg.sender] = true;
        voters[votersCount++] = msg.sender;
    }

    function startCommitPhase() public {
        require(msg.sender == owner, 'Only the owner can start the commit phase');
        require(revealPhase == false, 'Reveal phase has already begun. Too late!');

        commitPhase = true;
    }

    function startRevealPhase() public {
        require(msg.sender == owner, 'Only the owner can start the reveal phase');
        require(commitPhase == true, 'Reveal phase can not start before commit phase');

        commitPhase = false;
        revealPhase = true;
    }

    function vote(uint256 _vote) public {
        require(registered[msg.sender], 'Voter not registered');
        require(_vote > 0 && _vote < votables, 'Not a votable option');

        votes[msg.sender] = _vote;
    }

    function commit(bytes32 _hash) public {
        require(registered[msg.sender], 'Voter not registered');
        require(commitPhase == true, 'Commit phase has not started yet');

        commits[msg.sender] = _hash;
    }

    function reveal(string memory _secret) public {
        require(registered[msg.sender], 'Voter not registered');
        require(revealPhase == true, 'Reveal phase has not started yet');

        bytes32 hash = keccak256(bytes(_secret));

        require(hash == commits[msg.sender], 'reveal does not match commit');

        reveals[msg.sender] = _secret;
    }

    // Round Robin
    function roundRobin(uint256 _groups) private {
        assert(_groups <= votersCount);

        for(uint256 i = 0; i < votersCount; i++) {
            uint256 group = i % _groups;
            address voter = shuffled[i];

            groups[voter] = group;
        }
    }

    // Random Shuffle
    // Changes the order of voters mapping
    function randomShuffle(uint256 _seed) private {

        // Shuffle voters mapping
        for(uint256 i = 1; i < votersCount + 1; i++) {
            uint256 newIndex;

            do {
                newIndex = bigMod(_seed, i, votersCount);
                if (shuffled[newIndex] != address(0)) {
                    _seed++;
                }
            } while(shuffled[newIndex] != address(0));

            shuffled[newIndex] = voters[i - 1];
        }
    }

    // Random Grouping
    // _seed    = seed from owner
    // _groups  = number of groups set by owner
    function randomRoundRobin(uint256 _seed, uint256 _groups) public {
        // only the owner can perform this action
        require(msg.sender == owner);

        // shuffle all the voters
        randomShuffle(_seed);

        // group the shuffled voters in round robin style
//        roundRobin(_groups);
    }

    // Original Source from https://github.com/HarryR/solcrypto/blob/master/contracts/altbn128.sol
    // Commit 396fe4642cf39e2577217651a64bc3d19362ce42 License: MIT
    // From: https://gist.githubusercontent.com/chriseth/f9be9d9391efc5beb9704255a8e2989d/raw/4d0fb90847df1d4e04d507019031888df8372239/snarktest.solidity
    // Basically just calls the precompiled EVM contract/function 0x05 which calculates (_base ** _expoonent) % _modulus efficiently
    // Modified for Solitity ^0.5.0, original function name expMod()
    function bigMod(uint256 _base, uint256 _exponent, uint256 _modulus) public view returns (uint256 returnValue) {
        bool success;
        uint256[1] memory output;
        uint[6] memory input;
        input[0] = 0x20;        // baseLen = new(big.Int).SetBytes(getData(input, 0, 32))
        input[1] = 0x20;        // expLen  = new(big.Int).SetBytes(getData(input, 32, 32))
        input[2] = 0x20;        // modLen  = new(big.Int).SetBytes(getData(input, 64, 32))
        input[3] = _base;
        input[4] = _exponent;
        input[5] = _modulus;
        assembly {
            success := staticcall(sub(gas, 2000), 5, input, 0xc0, output, 0x20)
        // Use "revert" to make gas estimation work
            switch success case 0 {
                revert(0, 0)
            }
        }
        require(success);
        return output[0];
    }
}