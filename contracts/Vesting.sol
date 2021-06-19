// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/ILockManager.sol";
import "./interfaces/IYakToken.sol";
import "./interfaces/IVotingPower.sol";
import "./lib/SafeMath.sol";

/**
 * @title Vesting
 * @dev The vesting contract
 */
contract Vesting {
    using SafeMath for uint256;

    /// @notice Grant definition
    struct Grant {
        uint256 startTime;
        uint256 amount;
        uint256 vestingDuration;
        uint256 totalClaimed;
    }

    /// @dev Used to translate vesting periods specified in days to seconds
    uint256 constant internal SECONDS_PER_DAY = 86400;

    /// @notice YAK token
    IYakToken public token;

    /// @notice LockManager contract
    ILockManager public lockManager;

    /// @notice Mapping of recipient address > token grant
    mapping (address => Grant) public tokenGrants;

    /// @notice Current owner of this contract
    address public owner;

    /// @notice Event emitted when a new grant is created
    event GrantAdded(address indexed recipient, uint256 indexed amount, uint256 startTime, uint256 vestingDurationInDays);
    
    /// @notice Event emitted when tokens are claimed by a recipient from a grant
    event GrantTokensClaimed(address indexed recipient, uint256 indexed amountClaimed);
    
    /// @notice Event emitted when the owner of the vesting contract is updated
    event ChangedOwner(address indexed oldOwner, address indexed newOwner);

    /// @notice Event emitted when contract address is changed
    event ChangedAddress(string indexed addressType, address indexed oldAddress, address indexed newAddress);

    /**
     * @notice Construct a new Vesting contract
     * @param _token Address of YAK token
     */
    constructor(
        address _owner, 
        address _token, 
        address _lockManager
    ) {
        owner = _owner;
        emit ChangedOwner(address(0), _owner);

        require(_token != address(0), "Vest::constructor: must be valid token address");
        token = IYakToken(_token);

        lockManager = ILockManager(_lockManager);
        emit ChangedAddress("LOCK_MANAGER", address(0), _lockManager);
    }
    
    /**
     * @notice Add a new token grant
     * @param recipient The address that is receiving the grant
     * @param startTime The unix timestamp when the grant will start
     * @param amount The amount of tokens being granted
     * @param vestingDurationInDays The vesting period in days
     */
    function addTokenGrant(
        address recipient,
        uint256 startTime,
        uint256 amount,
        uint256 vestingDurationInDays
    ) 
        external
    {
        require(msg.sender == owner, "Vest::addTokenGrant: not owner");
        require(vestingDurationInDays > 0, "Vest::addTokenGrant: duration must be > 0");
        require(vestingDurationInDays <= 365, "Vest::addTokenGrant: duration more than 1 year");
        require(tokenGrants[recipient].amount == 0, "Vest::addTokenGrant: grant already exists for account");
        
        uint256 amountVestedPerDay = amount.div(vestingDurationInDays);
        require(amountVestedPerDay > 0, "Vest::addTokenGrant: amountVestedPerDay > 0");

        // Transfer the grant tokens under the control of the vesting contract
        require(token.transferFrom(owner, address(this), amount), "Vest::addTokenGrant: transfer failed");

        uint256 grantStartTime = startTime == 0 ? block.timestamp : startTime;

        Grant memory grant = Grant({
            startTime: grantStartTime,
            amount: amount,
            vestingDuration: vestingDurationInDays,
            totalClaimed: 0
        });
        tokenGrants[recipient] = grant;
        emit GrantAdded(recipient, amount, grantStartTime, vestingDurationInDays);
        lockManager.grantVotingPower(recipient, address(token), amount);
    }

    /**
     * @notice Get token grant for recipient
     * @param recipient The address that has a grant
     * @return the grant
     */
    function getTokenGrant(address recipient) public view returns(Grant memory){
        return tokenGrants[recipient];
    }

    /**
     * @notice Calculate the vested and unclaimed tokens available for `recipient` to claim
     * @dev Due to rounding errors once grant duration is reached, returns the entire left grant amount
     * @param recipient The address that has a grant
     * @return The amount recipient can claim
     */
    function calculateGrantClaim(address recipient) public view returns (uint256) {
        Grant storage tokenGrant = tokenGrants[recipient];

        // For grants created with a future start date, that hasn't been reached, return 0, 0
        if (block.timestamp < tokenGrant.startTime) {
            return 0;
        }

        // Check cliff was reached
        uint256 elapsedTime = block.timestamp.sub(tokenGrant.startTime);
        uint256 elapsedDays = elapsedTime.div(SECONDS_PER_DAY);
        
        // If over vesting duration, all tokens vested
        if (elapsedDays >= tokenGrant.vestingDuration) {
            uint256 remainingGrant = tokenGrant.amount.sub(tokenGrant.totalClaimed);
            return remainingGrant;
        } else {
            uint256 vestingDurationInSecs = tokenGrant.vestingDuration.mul(SECONDS_PER_DAY);
            uint256 vestingAmountPerSec = tokenGrant.amount.div(vestingDurationInSecs);
            uint256 amountVested = vestingAmountPerSec.mul(elapsedTime);
            uint256 claimableAmount = amountVested.sub(tokenGrant.totalClaimed);
            return claimableAmount;
        }
    }

    /**
     * @notice Calculate the vested (claimed + unclaimed) tokens for `recipient`
     * @param recipient The address that has a grant
     * @return Total vested balance (claimed + unclaimed)
     */
    function vestedBalance(address recipient) external view returns (uint256) {
        Grant storage tokenGrant = tokenGrants[recipient];

        // For grants created with a future start date, that hasn't been reached, return 0
        if (block.timestamp < tokenGrant.startTime) {
            return 0;
        }

        // Check cliff was reached
        uint256 elapsedTime = block.timestamp.sub(tokenGrant.startTime);
        uint256 elapsedDays = elapsedTime.div(SECONDS_PER_DAY);
        
        // If over vesting duration, all tokens vested
        if (elapsedDays >= tokenGrant.vestingDuration) {
            return tokenGrant.amount;
        } else {
            uint256 vestingDurationInSecs = tokenGrant.vestingDuration.mul(SECONDS_PER_DAY);
            uint256 vestingAmountPerSec = tokenGrant.amount.div(vestingDurationInSecs);
            uint256 amountVested = vestingAmountPerSec.mul(elapsedTime);
            return amountVested;
        }
    }

    /**
     * @notice The balance claimed by `recipient`
     * @param recipient The address that has a grant
     * @return the number of claimed tokens by `recipient`
     */
    function claimedBalance(address recipient) external view returns (uint256) {
        Grant storage tokenGrant = tokenGrants[recipient];
        return tokenGrant.totalClaimed;
    }

    /**
     * @notice Allows a grant recipient to claim their vested tokens
     * @dev Errors if no tokens have vested
     * @dev It is advised recipients check they are entitled to claim via `calculateGrantClaim` before calling this
     * @param recipient The address that has a grant
     */
    function claimVestedTokens(address recipient) external {
        uint256 amountVested = calculateGrantClaim(recipient);
        require(amountVested > 0, "Vest::claimVested: amountVested is 0");
        lockManager.removeVotingPower(recipient, address(token), amountVested);

        Grant storage tokenGrant = tokenGrants[recipient];
        tokenGrant.totalClaimed = tokenGrant.totalClaimed.add(amountVested);
        
        require(token.transfer(recipient, amountVested), "Vest::claimVested: transfer failed");
        emit GrantTokensClaimed(recipient, amountVested);
    }

    /**
     * @notice Set new LockManager address
     * @param newAddress address of new LockManager
     */
    function setLockManager(address newAddress) external {
        require(msg.sender == owner, "Vest::setLockManager: not owner");
        emit ChangedAddress("LOCK_MANAGER", address(lockManager), newAddress);
        lockManager = ILockManager(newAddress);
    }

    /**
     * @notice Change owner of vesting contract
     * @param newOwner New owner address
     */
    function changeOwner(address newOwner) 
        external
    {
        require(msg.sender == owner, "Vest::changeOwner: not owner");
        require(newOwner != address(0) && newOwner != address(this) && newOwner != address(token), "Vest::changeOwner: not valid address");

        address oldOwner = owner;
        owner = newOwner;
        emit ChangedOwner(oldOwner, newOwner);
    }
}