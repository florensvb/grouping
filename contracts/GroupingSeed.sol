pragma solidity >=0.4.22 <0.7.0;

contract GroupingSeed {
    // Init
    address payable owner = msg.sender;

    address[] public addresses;

    mapping(address => bool) public registered;
    mapping(address => uint256) public groups;
    mapping(address => uint256) public votes;

    uint256 public votables;

    event distributed(address indexed _address, uint256 indexed _group);
    event loop(uint256 indexed multiplier, uint256 indexed seed, uint256 indexed i);

    function declareVotables(uint256 _votables) public {
        require(msg.sender == owner);
        votables = _votables;
    }

    // Voter registration
    function registerVoter() public {
        require(!registered[msg.sender], "Voter already registered.");

        registered[msg.sender] = true;
        addresses.push(msg.sender);
    }

    function getVoterCount() public view returns(uint count) {
        return addresses.length;
    }

    function vote(uint256 _vote) public {
        require(registered[msg.sender], 'Voter not registered');
        require(_vote > 0 && _vote < votables, 'Not a votable option');

        votes[msg.sender] = _vote;
    }

    function distribute(uint256 _seed, uint256 _groups) public {
        require(msg.sender == owner);
        require(_groups > 1, 'There must be at least 2 groups');
        require(_seed > 0, 'That does not look like a real seed');
        require(addresses.length > 0, 'There are no voters');

        bytes32 prevBlockHash = blockhash(block.number - 1);
        uint256 multiplier = uint256(prevBlockHash);

        for(uint256 i = 0; i < addresses.length; i++) {
            address addr = addresses[i];
            uint256 group = (multiplier * (_seed + i)) % _groups;

            emit loop(multiplier, _seed, i);

            groups[addr] = group;

            emit distributed(addr, group);
        }
    }
}