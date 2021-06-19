// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IYakToken.sol";
import "./lib/SafeMath.sol";

/**
 * @title Claim
 * @dev The claim contract allows users to claim grants
 */
contract Claim {
    using SafeMath for uint256;

    /// @notice YAK token
    IYakToken public token;
    
    /// @notice Mapping of recipient address > current token grant balance
    mapping (address => uint256) public tokenGrants;

    /// @notice Current owner of this contract
    address public owner;

    /// @notice Event emitted when a new grant is created
    event Added(address indexed recipient, uint256 indexed amount);
    
    /// @notice Event emitted when tokens are claimed by a recipient from a grant
    event Claimed(address indexed recipient, uint256 indexed amountClaimed);
    
    /// @notice Event emitted when the owner of the vesting contract is updated
    event ChangedOwner(address indexed oldOwner, address indexed newOwner);

    /**
     * @notice Construct a new Claim contract
     * @param _token Address of YAK token
     */
    constructor(address _token) {
        require(_token != address(0), "Claim::constructor: must be valid token address");
        token = IYakToken(_token);
        owner = msg.sender;
    }
    
    /**
     * @notice Add a new token grant
     * @param recipient The address that is receiving the grant
     * @param amount The amount of tokens being granted
     */
    function addTokenGrant(
        address recipient,
        uint256 amount
    ) 
        external
    {
        require(msg.sender == owner, "Claim::addTokenGrant: not owner");
        require(amount > 0, "Claim::addTokenGrant: zero grant");
        
        require(token.transferFrom(owner, address(this), amount), "Claim::addTokenGrant: transfer failed");

        tokenGrants[recipient] = tokenGrants[recipient].add(amount);
        emit Added(recipient, amount);
    }

    /**
     * @notice Get token grant for recipient
     * @param recipient The address that has a grant
     * @return The amount recipient can claim
     */
    function getTokenGrant(address recipient) public view returns(uint256){
        return tokenGrants[recipient];
    }

    /**
     * @notice Allows a recipient to claim their tokens
     * @dev Errors if no tokens are available
     */
    function claim() external {
        uint256 availableToClaim = getTokenGrant(msg.sender);
        require(availableToClaim > 0, "Claim::claim: availableToClaim is 0");

        tokenGrants[msg.sender] = tokenGrants[msg.sender].sub(availableToClaim);
        
        require(token.transfer(msg.sender, availableToClaim), "Claim::claim: transfer failed");
        emit Claimed(msg.sender, availableToClaim);
    }

    /**
     * @notice Change owner of vesting contract
     * @param newOwner New owner address
     */
    function changeOwner(address newOwner) 
        external
    {
        require(msg.sender == owner, "Claim::changeOwner: not owner");
        require(newOwner != address(0) && newOwner != address(this) && newOwner != address(token), "Claim::changeOwner: not valid address");

        address oldOwner = owner;
        owner = newOwner;
        emit ChangedOwner(oldOwner, newOwner);
    }
}