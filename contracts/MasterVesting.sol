// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/ILockManager.sol";
import "./interfaces/IYakToken.sol";
import "./lib/SafeERC20.sol";
import "./interfaces/IVotingPower.sol";
import "./interfaces/IMasterYak.sol";
import "./lib/SafeMath.sol";

/**
 * @title MasterVesting
 * @dev The vesting contract for MasterYak deposits
 */
contract MasterVesting {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

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

    /// @notice MasterYak contract
    IMasterYak public masterYak;

    /// @notice MasterYak Pool Index for token
    uint256 public pid;

    /// @notice LockManager contract
    ILockManager public lockManager;

    /// @notice Token grant
    Grant public tokenGrant;

    /// @notice Current owner of this contract
    address public owner;

    /// @notice Event emitted when a new grant is created
    event GrantAdded(address indexed recipient, uint256 indexed amount, uint256 startTime, uint256 vestingDurationInDays);
    
    /// @notice Event emitted when tokens are claimed by a recipient from a grant
    event GrantTokensClaimed(address indexed recipient, uint256 indexed amountClaimed);

    /// @notice Event emitted when tokens are recovered by owner
    event Recovered(address token, uint256 amount);
    
    /// @notice Event emitted when the owner of the vesting contract is updated
    event ChangedOwner(address indexed oldOwner, address indexed newOwner);

    /// @notice Event emitted when contract address is changed
    event ChangedAddress(string indexed addressType, address indexed oldAddress, address indexed newAddress);

    /**
     * @notice Construct a new Vesting contract
     * @param _token Address of YAK token
     */
    constructor(
        address _token,
        address _masterYak,
        uint256 _pid,
        address _lockManager
    ) {
        owner = msg.sender;
        emit ChangedOwner(address(0), msg.sender);

        require(_token != address(0), "Vest::constructor: must be valid token address");
        token = IYakToken(_token);

        masterYak = IMasterYak(_masterYak);
        emit ChangedAddress("MASTER_YAK", address(0), _masterYak);

        pid = _pid;

        lockManager = ILockManager(_lockManager);
        emit ChangedAddress("LOCK_MANAGER", address(0), _lockManager);
    }
    
    /**
     * @notice Add a new token grant
     * @param amount The amount of tokens being granted
     * @param vestingDurationInDays The vesting period in days
     */
    function addTokenGrant(
        uint256 amount,
        uint256 vestingDurationInDays
    ) 
        external
    {
        require(msg.sender == owner, "Vest::addTokenGrant: not owner");
        require(vestingDurationInDays > 0, "Vest::addTokenGrant: duration must be > 0");
        require(vestingDurationInDays <= 365, "Vest::addTokenGrant: duration more than 1 year");
        require(tokenGrant.amount == 0, "Vest::addTokenGrant: grant already exists for account");
        
        uint256 amountVestedPerDay = amount.div(vestingDurationInDays);
        require(amountVestedPerDay > 0, "Vest::addTokenGrant: amountVestedPerDay > 0");

        // Transfer the grant tokens under the control of the vesting contract
        require(token.transferFrom(msg.sender, address(this), amount), "Vest::addTokenGrant: transfer failed");
        token.approve(address(masterYak), amount);
        masterYak.deposit(pid, amount);

        uint256 grantStartTime = block.timestamp;

        tokenGrant = Grant({
            startTime: grantStartTime,
            amount: amount,
            vestingDuration: vestingDurationInDays,
            totalClaimed: 0
        });
        emit GrantAdded(msg.sender, amount, grantStartTime, vestingDurationInDays);
        lockManager.grantVotingPower(msg.sender, address(token), amount);
    }

    receive() external payable {}

    /**
     * @notice Harvest MasterYak rewards and send entire balance to user
     */
    function harvest() external {
        require(msg.sender == owner, "Vest::harvest: not owner");
        masterYak.deposit(pid, 0);
        msg.sender.transfer(address(this).balance);
    }

    /**
     * @notice Get token grant
     * @return the grant
     */
    function getTokenGrant() public view returns (Grant memory) {
        return tokenGrant;
    }

    /**
     * @notice Calculate the vested and unclaimed tokens available to claim
     * @dev Due to rounding errors once grant duration is reached, returns the entire left grant amount
     * @return The amount available to claim
     */
    function calculateGrantClaim() public view returns (uint256) {

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
     * @notice Calculate the vested (claimed + unclaimed) tokens
     * @return Total vested balance (claimed + unclaimed)
     */
    function vestedBalance() external view returns (uint256) {
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
     * @notice The balance claimed
     * @return the number of claimed tokens
     */
    function claimedBalance() external view returns (uint256) {
        return tokenGrant.totalClaimed;
    }

    /**
     * @notice Claim vested tokens
     * @dev Errors if no tokens have vested
     * @dev It is advised to check `calculateGrantClaim` before calling this
     */
    function claimVestedTokens() external {
        require(msg.sender == owner, "Vest::claimVested: not owner");

        uint256 amountVested = calculateGrantClaim();
        require(amountVested > 0, "Vest::claimVested: amountVested is 0");
        lockManager.removeVotingPower(msg.sender, address(token), amountVested);

        tokenGrant.totalClaimed = tokenGrant.totalClaimed.add(amountVested);

        masterYak.withdraw(pid, amountVested);
        
        require(token.transfer(msg.sender, amountVested), "Vest::claimVested: transfer failed");
        emit GrantTokensClaimed(msg.sender, amountVested);
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
     * @notice Recover ERC20 from contract
     * @param tokenAddress token address
     * @param tokenAmount amount to recover
     */
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external {
        require(msg.sender == owner, "Vest::recoverERC20: not owner");
        require(tokenAmount > 0, "Vest::recoverERC20: amount is 0");
        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    /**
     * @notice Change owner of vesting contract
     * @param newOwner New owner address
     */
    function changeOwner(address newOwner) 
        external
    {
        require(msg.sender == owner, "Vest::changeOwner: not owner");
        require(newOwner != address(0) && newOwner != address(this) && newOwner != address(token) && newOwner != address(masterYak), "Vest::changeOwner: not valid address");

        address oldOwner = owner;
        owner = newOwner;
        emit ChangedOwner(oldOwner, newOwner);
    }
}