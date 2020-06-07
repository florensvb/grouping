pragma solidity >=0.5.0 <0.7.0;

import "./provableAPI.sol";
import "./SmartDiffieHellman.sol";

contract ShuffleAndRoundRobin is usingProvable {

    // provableAPI
    uint public provableRandomNumber;

    // 0. Contract state
    enum State { Init, Register, Commit, Reveal, Vote }
    State public state = State.Init;

    // 1. Register all accounts
    address[] public registered;
    mapping(address => bool) public isRegistered; // only allow registration once

    // 2. Commit Reveal
    mapping(address => bytes32) public commits;
    mapping(address => string) public reveals;

    // seed from owner
    bytes32 public seedCommit;
    string public seedReveal;

    // 3. distribute accounts in round robin
    mapping(address => uint256) public groups;
    uint256 public numberOfGroups;

    // 4. shuffle the accounts
    address[] public shuffled;
    mapping(address => bool) isShuffled;

    // only the contract owner can start distribution and selfdestruct the contract
    address payable owner = msg.sender;

    // voting
    uint256[] public votingOptions;
    mapping(address => mapping(address => string)) public votes;
    mapping(address => uint256[]) public groupTotals;

    // debugging events
    event randomNr(uint256 indexed _rand, bool indexed _accepted);
    event distributed(address indexed _address, uint256 indexed _group);
    event LogNewRandomNumber(string randomNumber);
    event LogNewProvableQuery(string description);

    constructor() public {
        OAR = OracleAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
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

    // set voting options
    function setVotingOptions(uint256[] memory _votingOptions) public {
        require(msg.sender == owner, 'Sender must be owner');
        require(_votingOptions.length > 1, 'There must be at least two voting options');
        require(state == State.Init, 'State must be Init');

        state = State.Register;

        votingOptions = _votingOptions;
    }

    // ======= 1. =======
    function register() public {
        require(state == State.Register, 'Not in state Register');
        require(!isRegistered[msg.sender], 'Already registered');

        isRegistered[msg.sender] = true;
        registered.push(msg.sender);
    }

    // ======= 2.1 =======
    function startCommitPhase(bytes32 _seedCommit) public {
        require(state == State.Register, 'Must be in registration phase');
        require(msg.sender == owner, 'Only the owner can start the commit phase');
        require(_seedCommit.length > 0, 'The seed is not good enough');

        state = State.Commit;

        seedCommit = _seedCommit;
    }

    // ======= 2.2 =======
    function startRevealPhase(string memory _seedReveal) public {
        require(state == State.Commit, 'Must be in commit phase');
        require(msg.sender == owner, 'Only the owner can start the reveal phase');

        state = State.Reveal;

        bytes32 hash = keccak256(bytes(_seedReveal));

        require(hash == seedCommit, 'Seed from owner does not match the commit');

        seedReveal = _seedReveal;
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
    function distribute(uint256 _groups) public {
        require(msg.sender == owner);
        require(provableRandomNumber > 0, 'Random number from provable must exist');
        require(state == State.Reveal, 'Must be in reveal phase');
        require(_groups > 1, 'There must be more than 1 group');
        require(bytes(seedReveal).length > 0, 'No seed from owner found');
        require(registered.length > 0, 'There are no registered voters');

        shuffle(uint256(keccak256(abi.encodePacked(seedReveal))));
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
        require(msg.sender == owner);

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
        require(msg.sender == owner);

        for(uint256 i = 0; i < shuffled.length; i++) {
            groups[registered[i]] = i % _groups;
        }

        numberOfGroups = _groups;
        state = State.Vote;
    }

    // ========== smartDHX ===========
    mapping(bytes32 => SmartDiffieHellman) public smartDHXs;

    function getEdgeKey(address _first, address _second) public pure returns (bytes32 _edgeKey) {
        return keccak256(abi.encodePacked(_first, _second));
    }

    function deploySmartDHX(address _first, address _second) public {
        require(msg.sender == owner);
        require(state == State.Vote);

        SmartDiffieHellman firstSmartDHX = new SmartDiffieHellman();
        SmartDiffieHellman secondSmartDHX = new SmartDiffieHellman();

        bytes32 firstEdgeKey = getEdgeKey(_first, _second);
        bytes32 secondEdgeKey = getEdgeKey(_second, _first);

        smartDHXs[firstEdgeKey] = firstSmartDHX;
        smartDHXs[secondEdgeKey] = secondSmartDHX;
    }

    function sendVote(string memory _vote, address _to) public {
        require(state == State.Vote, 'Not in voting state');
        require(bytes(votes[msg.sender][_to]).length == 0, 'Vote was already sent');

        votes[msg.sender][_to] = _vote;
    }

    function broadcastGroupTotalVotes(uint256[] memory _groupTotals) public {
        require(_groupTotals.length == votingOptions.length, 'Group totals must have total for each voting option');
        require(groupTotals[msg.sender].length == 0, 'Sender already broadcasted the group totals');

        groupTotals[msg.sender] = _groupTotals;
    }

    function stop() public {
        require(msg.sender == owner);
        selfdestruct(msg.sender);
    }
}