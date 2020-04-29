pragma solidity >=0.5.0 <0.7.0;

import "./provableAPI.sol";

contract ShuffleAndRoundRobin is usingProvable {

    // provableAPI
    uint public provableRandomNumber;

    // 0. Contract state
    enum State { Register, Commit, Reveal, Vote }
    State public state = State.Register;

    // 1. Register all accounts
    address[] public registered;
    mapping(address => bool) public isRegistered; // only allow registration once

    // 2. Commit Reveal
    mapping(address => bytes32) public commits;
    mapping(address => string) public reveals;

    // 3. distribute accounts in round robin
    mapping(address => uint256) public groups;

    // 4. shuffle the accounts
    address[] public shuffled;
    mapping(address => bool) isShuffled;

    // only the contract owner can start distribution and selfdestruct the contract
    address payable owner = msg.sender;

    // debugging events
    event randomNr(uint256 indexed _rand, bool indexed _accepted);
    event distributed(address indexed _address, uint256 indexed _group);
    event LogNewRandomNumber(string randomNumber);
    event LogNewProvableQuery(string description);

    constructor() public {
        OAR = OracleAddrResolverI(0x864b12a155Db678F6033A963bC2e1c35B8cEbFda);
    }

    function __callback(bytes32 myid, string memory result) public
    {
        require(msg.sender == provable_cbAddress());
        emit LogNewRandomNumber(result);
        provableRandomNumber = parseInt(result);
    }

    function getProvableRandomNumber() public payable
    {
        require(msg.sender == owner, 'Only the owner can get a random number from provable');
        emit LogNewProvableQuery("Provable query was sent, standing by for the answer...");
        provable_query("URL", "https://www.random.org/integers/?num=1&min=1&max=1000000000&col=1&base=10&format=plain&rnd=new");
    }

    // ======= 1. =======
    function register() public {
        require(state == State.Register);
        require(!isRegistered[msg.sender]);

        isRegistered[msg.sender] = true;
        registered.push(msg.sender);
    }

    // ======= 2.1 =======
    function startCommitPhase() public {
        require(msg.sender == owner, 'Only the owner can start the commit phase');
        require(state == State.Register, 'Must be in registration phase');

        state = State.Commit;
    }

    // ======= 2.2 =======
    function startRevealPhase() public {
        require(msg.sender == owner, 'Only the owner can start the reveal phase');
        require(state == State.Commit, 'Must be in commit phase');

        state = State.Reveal;
    }

    // ======= 2.3 =======
    function commit(bytes32 _hash) public {
        require(isRegistered[msg.sender], 'Voter not registered');
        require(state == State.Commit, 'Must be in commit phase');

        commits[msg.sender] = _hash;
    }

    // ======= 2.4 =======
    function reveal(string memory _secret) public {
        require(isRegistered[msg.sender], 'Voter not registered');
        require(state == State.Reveal, 'Must be in reveal phase');

        bytes32 hash = keccak256(bytes(_secret));

        require(hash == commits[msg.sender], 'reveal does not match commit');

        reveals[msg.sender] = _secret;
    }

    // ======= 3. =======
    function distribute(uint256[] memory _seed, uint256 _groups) public {
        require(msg.sender == owner);
        require(provableRandomNumber > 0, 'Random number from provable must exist');
        require(state == State.Reveal, 'Must be in reveal phase');
        require(_groups > 1, 'There must be more than 1 group');
        require(_seed.length > 0 && _seed[0] > 0, 'The seed is not good enough');
        require(registered.length > 0, 'There are no registered voters');

        shuffle(uint256(keccak256(abi.encodePacked(_seed))));
        roundRobin(_groups);

        state = State.Vote;

        for(uint256 i = 0; i < registered.length; i++) {
            address addr = registered[i];
            uint256 group = groups[addr];

            emit distributed(addr, group);
        }
    }

    // ======= 4. =======
    function shuffle(uint256 _seed) private {
        assert(msg.sender == owner);

        // prevBlockHash
        uint256 prevBlockHash = uint256(blockhash(block.number - 1));

        uint256 allReveals;
        // reveals
        for(uint256 i = 0; i < registered.length; i++) {
            allReveals += uint256(keccak256(abi.encodePacked(reveals[msg.sender])));
        }

        uint256 prevRand = 1;

        for(uint256 i = 0; i < registered.length; i++) {
            uint256 rand;
            uint256 randPosition;

            // search for a registered address which has not been shuffled
            do {
                // values from Java's java.util.Random, POSIX [ln]rand48, glibc [ln]rand48[_r],
                // see https://en.wikipedia.org/wiki/Linear_congruential_generator#Parameters_in_common_use
                rand = (prevRand * 25214903917 + 11) % (2 ** 48);
                prevRand = rand;

                // last block hash
                randPosition = rand + prevBlockHash;
                // seed from owner
                randPosition += _seed;
                // reveals from voters
                randPosition += allReveals;
                // timestamp of current block
                randPosition += now;
                // random number from provable
                randPosition += provableRandomNumber;

                // find a position in the mapping
                randPosition = randPosition % registered.length;

                emit randomNr(randPosition, !isShuffled[registered[randPosition]]);
            } while(isShuffled[registered[randPosition]]);

            isShuffled[registered[randPosition]] = true;

            shuffled.push(registered[randPosition]);
        }
    }

    function roundRobin(uint256 _groups) private {
        assert(msg.sender == owner);

        for(uint256 i = 0; i < shuffled.length; i++) {
            groups[registered[i]] = i % _groups;
        }
    }

    function stop() public {
        require(msg.sender == owner);
        selfdestruct(msg.sender);
    }
}