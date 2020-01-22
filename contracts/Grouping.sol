pragma solidity >=0.4.21 <0.7.0;

contract Grouping {
    // the owner of the contract
    address public owner;

    // a participant
    struct Participant {
        string name;
        address participantAddress;
    }

    // number of groups
    uint private groupCount = 0;

    // a group
    struct Group {
        uint groupNumber;
    }

    // list of groups
    Group[] groups;

    // list of participants
    Participant[] participants;

    // an address points to a participant
    mapping (address => Participant) public addressToParticipant;
    // an address points to a group
    mapping (address => Group) public addressToGroup;

    // saving the owner of the contract
    constructor() public {
        owner = msg.sender;
    }

    // register new participants
    function register(string memory _name) public {
        // create a new participant
        Participant memory participant = Participant(_name, msg.sender);
        // push it to the array
        participants.push(participant);
        // save it in the mapping
        addressToParticipant[msg.sender] = participant;
        // create a new group
        Group memory group = createGroup();
        // add participant to new group
        addParticipantToGroup(participant, group);
    }

    // return a participant
    function getParticipant() public view returns (string memory name, address participantAddress) {
        Participant memory participant = addressToParticipant[msg.sender];
        return (participant.name, participant.participantAddress);
    }

    // create a new group
    function createGroup() private returns (Group memory) {
        Group memory group = Group(groupCount++);
        groups.push(group);
        return group;
    }

    // add participant to group
    function addParticipantToGroup(Participant memory participant, Group memory group) private {
        addressToGroup[participant.participantAddress] = group;
    }
}
