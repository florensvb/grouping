pragma solidity >=0.5.0 <0.7.0;

contract ShuffleAndRoundRobin {
    // 1. Register all accounts
    address[] public registered;
    mapping(address => bool) public isRegistered; // only allow registration once

    // 2. Commit Reveal
    mapping(address => bytes32) public commits;
    mapping(address => string) public reveals;

    // 3. shuffle the accounts
    address[] public shuffled;
    mapping(address => bool) isShuffled;

    // 4. distribute accounts in round robin
    mapping(address => uint256) public groups;

    // contract state
    enum State { Register, Commit, Reveal, Vote }
    State public state = State.Register;

    // only the contract owner can start distribution and selfdestruct the contract
    address payable owner = msg.sender;

    // debugging event
    event randomNr(uint256 indexed _rand, bool indexed _accepted);
    event distributed(address indexed _address, uint256 indexed _group);

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
    function shuffle(uint256 _seed) private {
        assert(msg.sender == owner);

        uint256 prevBlockHash = uint256(blockhash(block.number - 1));

        uint256 prevRand = 1;

        for(uint256 i = 0; i < registered.length; i++) {
            uint256 rand;
            uint256 randPosition;

            // search for a registered address which has not been shuffled
            do {
                // values from Java's java.util.Random, POSIX [ln]rand48, glibc [ln]rand48[_r],
                // see https://en.wikipedia.org/wiki/Linear_congruential_generator#Parameters_in_common_use
                rand = (25214903917 * prevRand + 11) % (2 ** 48);
                prevRand = rand;

                randPosition = (prevBlockHash + _seed + rand) % registered.length;

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

    // ======= 4. =======
    function distribute(uint256[] memory _seed, uint256 _groups) public {
        require(msg.sender == owner);
        require(state == State.Reveal, 'Must be in reveal phase');
        require(_groups > 0);
        require(_seed.length > 0 && _seed[0] > 0);
        require(registered.length > 0);

        shuffle(uint256(keccak256(abi.encodePacked(_seed))));
        roundRobin(_groups);

        state = State.Vote;

        for(uint256 i = 0; i < registered.length; i++) {
            address addr = registered[i];
            uint256 group = groups[addr];

            emit distributed(addr, group);
        }
    }

    function stop() public {
        require(msg.sender == owner);
        selfdestruct(msg.sender);
    }
}