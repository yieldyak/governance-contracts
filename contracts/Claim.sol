// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "./lib/SafeMath.sol";
import "./lib/SafeERC20.sol";

/**
 * @title Claim
 * @dev The claim contract allows users to claim grants. Any unclaimed tokens may
 *  be recovered by owner after a given deadline.
 */
contract Claim {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice YAK token
    IERC20 public token;

    /// @notice Deadline to claim tokens
    uint256 public deadline;
    
    /// @notice Mapping of recipient address > current token grant balance
    mapping (address => uint256) public tokenGrants;

    /// @notice Current owner of this contract
    address public owner;

    /// @notice Event emitted when a new grant is created
    event Added(address indexed recipient, uint256 indexed amount);
    
    /// @notice Event emitted when tokens are claimed by a recipient from a grant
    event Claimed(address indexed recipient, uint256 indexed amountClaimed);

    /// @notice Event emitted when tokens are recovered by owner
    event Recovered(address token, uint256 amount);
    
    /// @notice Event emitted when the owner of the vesting contract is updated
    event ChangedOwner(address indexed oldOwner, address indexed newOwner);

    /**
     * @notice Construct a new Claim contract
     * @param _token Address of YAK token
     */
    constructor(address _token, uint256 daysToClaim) {
        require(_token != address(0), "Claim::constructor: must be valid token address");
        token = IERC20(_token);
        owner = msg.sender;
        deadline = block.timestamp.add(daysToClaim.mul(86400));
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
        require(block.timestamp < deadline, "Claim::addTokenGrant: too late");
        require(msg.sender == owner, "Claim::addTokenGrant: not owner");
        require(amount > 0, "Claim::addTokenGrant: zero grant");
        
        token.safeTransferFrom(owner, address(this), amount);

        tokenGrants[recipient] = tokenGrants[recipient].add(amount);
        emit Added(recipient, amount);
    }
    
    /**
     * @notice Batch add new token grants
     * @param recipients The addresses that are receiving grants
     * @param amounts The amounts of tokens being granted
     * @param totalTokens The total tokens being granted (checksum)
     */
    function addTokenGrants(
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint256 totalTokens
    ) 
        external
    {
        require(block.timestamp < deadline, "Claim::addTokenGrants: too late");
        require(msg.sender == owner, "Claim::addTokenGrants: not owner");
        require(recipients.length == amounts.length, "Claim::addTokenGrants: different lengths");
        
        token.safeTransferFrom(owner, address(this), totalTokens);

        for (uint256 i = 0; i < recipients.length; i++) {
            totalTokens = totalTokens.sub(amounts[i]);
            tokenGrants[recipients[i]] = tokenGrants[recipients[i]].add(amounts[i]);
            emit Added(recipients[i], amounts[i]);
        }

        require(totalTokens == 0, "Claim::addTokenGrants: wrong output");
    }

    /**
     * @notice Get token grant for recipient
     * @dev Returns 0 if `deadline` is reached
     * @param recipient The address that has a grant
     * @return The amount recipient can claim
     */
    function getTokenGrant(address recipient) public view returns(uint256){
        if (block.timestamp < deadline) {
            return tokenGrants[recipient];
        }
        return 0;
    }

    /**
     * @notice Allows a recipient to claim their tokens
     * @dev Errors if no tokens are available
     */
    function claim() external {
        uint256 availableToClaim = getTokenGrant(msg.sender);
        require(availableToClaim > 0, "Claim::claim: availableToClaim is 0");

        tokenGrants[msg.sender] = 0;
        
        token.safeTransfer(msg.sender, availableToClaim);
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

    /**
     * @notice Recover ERC20 from contract
     * @param tokenAddress token address
     * @param tokenAmount amount to recover
     */
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external {
        require(msg.sender == owner, "Claim::recoverERC20: not owner");
        require(block.timestamp >= deadline, "Claim::recoverERC20: too early");
        require(tokenAmount > 0, "Claim::recoverERC20: amount is 0");
        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }
}