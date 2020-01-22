pragma solidity >=0.4.21 <0.7.0;

contract Grouping {
    address public owner;

    struct Participant {
        string name;
        address participantAddress;
    }

    // an address points to a participant
    mapping (address => Participant) public participants;
    // an address points to a group
    mapping (address => uint) public groups;

    // saving the owner of the contract
    constructor() public {
        owner = msg.sender;
    }

    // register new participants
    function register(string memory _name) public {
        participants[msg.sender] = Participant(_name, msg.sender);
    }

    // return a participant
    function getParticipant() public view returns (string memory name, address participantAddress) {
        Participant memory participant = participants[msg.sender];
        return (participant.name, participant.participantAddress);
    }
}
