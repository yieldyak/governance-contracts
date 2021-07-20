// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/ILockManager.sol";
import "./lib/SafeMath.sol";
import "./lib/SafeERC20.sol";
import "./lib/ReentrancyGuard.sol";

/**
 * @title MasterYak
 * @dev Controls rewards distribution for network
 */
contract MasterYak is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice Current owner of this contract
    address public owner;

    /// @notice Info of each user.
    struct UserInfo {
        uint256 amount;          // How many tokens the user has provided.
        uint256 rewardTokenDebt; // Reward debt for reward token. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of reward tokens
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accRewardsPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws tokens to a pool. Here's what happens:
        //   1. The pool's `accRewardsPerShare` (and `lastRewardTimestamp`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    /// @notice Info of each pool.
    struct PoolInfo {
        IERC20 token;                // Address of token contract.
        uint256 allocPoint;          // How many allocation points assigned to this pool. Reward tokens to distribute per second.
        uint256 lastRewardTimestamp; // Last timestamp where reward tokens were distributed.
        uint256 accRewardsPerShare;  // Accumulated reward tokens per share, times 1e12. See below.
        uint256 totalStaked;         // Total amount of token staked via Rewards Manager
        bool vpForDeposit;           // Do users get voting power for deposits of this token?
    }

    /// @notice LockManager contract
    ILockManager public lockManager;

    /// @notice Rewards rewarded per second
    uint256 public rewardsPerSecond;

    /// @notice Info of each pool.
    PoolInfo[] public poolInfo;
    
    /// @notice Info of each user that stakes tokens
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    
    /// @notice Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;

    /// @notice The timestamp when rewards start.
    uint256 public startTimestamp;

    /// @notice The timestamp when rewards end.
    uint256 public endTimestamp;

    /// @notice only owner can call function
    modifier onlyOwner {
        require(msg.sender == owner, "not owner");
        _;
    }

    /// @notice Event emitted when a user deposits funds in the rewards manager
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);

    /// @notice Event emitted when a user withdraws their original funds + rewards from the rewards manager
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);

    /// @notice Event emitted when a user withdraws their original funds from the rewards manager without claiming rewards
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    /// @notice Event emitted when new pool is added to the rewards manager
    event PoolAdded(uint256 indexed pid, address indexed token, uint256 allocPoints, uint256 totalAllocPoints, uint256 rewardStartTimestamp, bool vpForDeposit);
    
    /// @notice Event emitted when pool allocation points are updated
    event PoolUpdated(uint256 indexed pid, uint256 oldAllocPoints, uint256 newAllocPoints, uint256 newTotalAllocPoints);

    /// @notice Event emitted when the owner of the rewards manager contract is updated
    event ChangedOwner(address indexed oldOwner, address indexed newOwner);

    /// @notice Event emitted when the amount of reward tokens per seconds is updated
    event ChangedRewardsPerSecond(uint256 indexed oldRewardsPerSecond, uint256 indexed newRewardsPerSecond);

    /// @notice Event emitted when the rewards start timestamp is set
    event SetRewardsStartTimestamp(uint256 indexed startTimestamp);

    /// @notice Event emitted when the rewards end timestamp is updated
    event ChangedRewardsEndTimestamp(uint256 indexed oldEndTimestamp, uint256 indexed newEndTimestamp);

    /// @notice Event emitted when contract address is changed
    event ChangedAddress(string indexed addressType, address indexed oldAddress, address indexed newAddress);

    /**
     * @notice Create a new Rewards Manager contract
     * @param _owner owner of contract
     * @param _lockManager address of LockManager contract
     * @param _startTimestamp timestamp when rewards will start
     * @param _rewardsPerSecond initial amount of reward tokens to be distributed per second
     */
    constructor(
        address _owner, 
        address _lockManager,
        uint256 _startTimestamp,
        uint256 _rewardsPerSecond
    ) {
        owner = _owner;
        emit ChangedOwner(address(0), _owner);

        lockManager = ILockManager(_lockManager);
        emit ChangedAddress("LOCK_MANAGER", address(0), _lockManager);

        startTimestamp = _startTimestamp == 0 ? block.timestamp : _startTimestamp;
        emit SetRewardsStartTimestamp(startTimestamp);

        rewardsPerSecond = _rewardsPerSecond;
        emit ChangedRewardsPerSecond(0, _rewardsPerSecond);
    }

    receive() external payable {}

    /**
     * @notice View function to see current poolInfo array length
     * @return pool length
     */
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /**
     * @notice Add a new reward token to the pool
     * @dev Can only be called by the owner. DO NOT add the same token more than once. Rewards will be messed up if you do.
     * @param allocPoint Number of allocation points to allot to this token/pool
     * @param token The token that will be staked for rewards
     * @param withUpdate if specified, update all pools before adding new pool
     * @param vpForDeposit If true, users get voting power for deposits
     */
    function add(
        uint256 allocPoint, 
        address token,
        bool withUpdate,
        bool vpForDeposit
    ) external onlyOwner {
        if (withUpdate) {
            massUpdatePools();
        }
        uint256 rewardStartTimestamp = block.timestamp > startTimestamp ? block.timestamp : startTimestamp;
        if (totalAllocPoint == 0) {
            _setRewardsEndTimestamp();
        }
        totalAllocPoint = totalAllocPoint.add(allocPoint);
        poolInfo.push(PoolInfo({
            token: IERC20(token),
            allocPoint: allocPoint,
            lastRewardTimestamp: rewardStartTimestamp,
            accRewardsPerShare: 0,
            totalStaked: 0,
            vpForDeposit: vpForDeposit
        }));
        emit PoolAdded(poolInfo.length - 1, token, allocPoint, totalAllocPoint, rewardStartTimestamp, vpForDeposit);
    }

    /**
     * @notice Update the given pool's allocation points
     * @dev Can only be called by the owner
     * @param pid The RewardManager pool id
     * @param allocPoint New number of allocation points for pool
     * @param withUpdate if specified, update all pools before setting allocation points
     */
    function set(
        uint256 pid, 
        uint256 allocPoint, 
        bool withUpdate
    ) external onlyOwner {
        if (withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[pid].allocPoint).add(allocPoint);
        emit PoolUpdated(pid, poolInfo[pid].allocPoint, allocPoint, totalAllocPoint);
        poolInfo[pid].allocPoint = allocPoint;
    }

    /**
     * @notice Returns true if rewards are actively being accumulated
     */
    function rewardsActive() public view returns (bool) {
        return block.timestamp >= startTimestamp && block.timestamp <= endTimestamp && totalAllocPoint > 0 ? true : false;
    }

    /**
     * @notice Return reward multiplier over the given from to to timestamp.
     * @param from From timestamp
     * @param to To timestamp
     * @return multiplier
     */
    function getMultiplier(uint256 from, uint256 to) public view returns (uint256) {
        uint256 toTimestamp = to > endTimestamp ? endTimestamp : to;
        return toTimestamp > from ? toTimestamp.sub(from) : 0;
    }

    /**
     * @notice View function to see pending rewards on frontend.
     * @param pid pool id
     * @param account user account to check
     * @return pending rewards
     */
    function pendingRewards(uint256 pid, address account) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][account];
        uint256 accRewardsPerShare = pool.accRewardsPerShare;
        uint256 tokenSupply = pool.totalStaked;
        if (block.timestamp > pool.lastRewardTimestamp && tokenSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardTimestamp, block.timestamp);
            uint256 totalReward = multiplier.mul(rewardsPerSecond).mul(pool.allocPoint).div(totalAllocPoint);
            accRewardsPerShare = accRewardsPerShare.add(totalReward.mul(1e12).div(tokenSupply));
        }

        uint256 accumulatedRewards = user.amount.mul(accRewardsPerShare).div(1e12);
        
        if (accumulatedRewards < user.rewardTokenDebt) {
            return 0;
        }

        return accumulatedRewards.sub(user.rewardTokenDebt);
    }

    /**
     * @notice Update reward variables for all pools
     * @dev Be careful of gas spending!
     */
    function massUpdatePools() public {
        for (uint256 pid = 0; pid < poolInfo.length; ++pid) {
            updatePool(pid);
        }
    }

    /**
     * @notice Update reward variables of the given pool to be up-to-date
     * @param pid pool id
     */
    function updatePool(uint256 pid) public {
        PoolInfo storage pool = poolInfo[pid];
        if (block.timestamp <= pool.lastRewardTimestamp) {
            return;
        }

        uint256 tokenSupply = pool.totalStaked;
        if (tokenSupply == 0) {
            pool.lastRewardTimestamp = block.timestamp;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardTimestamp, block.timestamp);
        uint256 totalReward = multiplier.mul(rewardsPerSecond).mul(pool.allocPoint).div(totalAllocPoint);
        pool.accRewardsPerShare = pool.accRewardsPerShare.add(totalReward.mul(1e12).div(tokenSupply));
        pool.lastRewardTimestamp = block.timestamp;
    }

    /**
     * @notice Deposit tokens to MasterYak for rewards allocation.
     * @param pid pool id
     * @param amount number of tokens to deposit
     */
    function deposit(uint256 pid, uint256 amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];
        _deposit(pid, amount, pool, user);
    }

    /**
     * @notice Deposit tokens to MasterYak for rewards allocation, using permit for approval
     * @dev It is up to the frontend developer to ensure the pool token implements permit - otherwise this will fail
     * @param pid pool id
     * @param amount number of tokens to deposit
     * @param deadline The time at which to expire the signature
     * @param v The recovery byte of the signature
     * @param r Half of the ECDSA signature pair
     * @param s Half of the ECDSA signature pair
     */
    function depositWithPermit(
        uint256 pid, 
        uint256 amount,
        uint256 deadline, 
        uint8 v, 
        bytes32 r, 
        bytes32 s
    ) external nonReentrant {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];
        pool.token.permit(msg.sender, address(this), amount, deadline, v, r, s);
        _deposit(pid, amount, pool, user);
    }

    /**
     * @notice Withdraw tokens from MasterYak, claiming rewards.
     * @param pid pool id
     * @param amount number of tokens to withdraw
     */
    function withdraw(uint256 pid, uint256 amount) external nonReentrant {
        require(amount > 0, "MasterYak::withdraw: amount must be > 0");
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];
        _withdraw(pid, amount, pool, user);
    }

    /**
     * @notice Withdraw without caring about rewards. EMERGENCY ONLY.
     * @param pid pool id
     */
    function emergencyWithdraw(uint256 pid) external nonReentrant {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];

        if (user.amount > 0) {

            if (pool.vpForDeposit) {
                lockManager.removeVotingPower(msg.sender, address(pool.token), user.amount);
            }

            pool.totalStaked = pool.totalStaked.sub(user.amount);
            pool.token.safeTransfer(msg.sender, user.amount);

            emit EmergencyWithdraw(msg.sender, pid, user.amount);

            user.amount = 0;
            user.rewardTokenDebt = 0;
        }
    }

    /**
     * @notice Set new rewards per second
     * @dev Can only be called by the owner
     * @param newRewardsPerSecond new amount of rewards to reward each second
     */
    function setRewardsPerSecond(uint256 newRewardsPerSecond) external onlyOwner {
        emit ChangedRewardsPerSecond(rewardsPerSecond, newRewardsPerSecond);
        rewardsPerSecond = newRewardsPerSecond;
        _setRewardsEndTimestamp();
    }
        
    /**
     * @notice Set new LockManager address
     * @param newAddress address of new LockManager
     */
    function setLockManager(address newAddress) external onlyOwner {
        emit ChangedAddress("LOCK_MANAGER", address(lockManager), newAddress);
        lockManager = ILockManager(newAddress);
    }

    /**
     * @notice Add rewards to contract
     * @dev Can only be called by the owner
     */
    function addRewardsBalance() external payable onlyOwner {
        _setRewardsEndTimestamp();
    }

    /**
     * @notice Change owner of vesting contract
     * @dev Can only be called by the owner
     * @param newOwner New owner address
     */
    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0) && newOwner != address(this), "MasterYak::changeOwner: not valid address");
        emit ChangedOwner(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @notice Internal implementation of deposit
     * @param pid pool id
     * @param amount number of tokens to deposit
     * @param pool the pool info
     * @param user the user info 
     */
    function _deposit(
        uint256 pid, 
        uint256 amount, 
        PoolInfo storage pool, 
        UserInfo storage user
    ) internal {
        updatePool(pid);

        if (user.amount > 0) {
            uint256 pendingRewardAmount = user.amount.mul(pool.accRewardsPerShare).div(1e12).sub(user.rewardTokenDebt);

            if (pendingRewardAmount > 0) {
                _safeRewardsTransfer(msg.sender, pendingRewardAmount);
            }
        }
       
        pool.token.safeTransferFrom(msg.sender, address(this), amount);
        pool.totalStaked = pool.totalStaked.add(amount);
        user.amount = user.amount.add(amount);
        user.rewardTokenDebt = user.amount.mul(pool.accRewardsPerShare).div(1e12);

        if (amount > 0 && pool.vpForDeposit) {
            lockManager.grantVotingPower(msg.sender, address(pool.token), amount);
        }

        emit Deposit(msg.sender, pid, amount);
    }

    /**
     * @notice Internal implementation of withdraw
     * @param pid pool id
     * @param amount number of tokens to withdraw
     * @param pool the pool info
     * @param user the user info 
     */
    function _withdraw(
        uint256 pid, 
        uint256 amount,
        PoolInfo storage pool, 
        UserInfo storage user
    ) internal {
        require(user.amount >= amount, "MasterYak::_withdraw: amount > user balance");

        updatePool(pid);

        uint256 pendingRewardAmount = user.amount.mul(pool.accRewardsPerShare).div(1e12).sub(user.rewardTokenDebt);
        user.amount = user.amount.sub(amount);
        user.rewardTokenDebt = user.amount.mul(pool.accRewardsPerShare).div(1e12);

        if (pendingRewardAmount > 0) {
            _safeRewardsTransfer(msg.sender, pendingRewardAmount);
        }
        
        if (pool.vpForDeposit) {
            lockManager.removeVotingPower(msg.sender, address(pool.token), amount);
        }

        pool.totalStaked = pool.totalStaked.sub(amount);
        pool.token.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, pid, amount);
    }

    /**
     * @notice Safe reward transfer function, just in case if rounding error causes pool to not have enough reward token.
     * @param to account that is receiving rewards
     * @param amount amount of rewards to send
     */
    function _safeRewardsTransfer(address payable to, uint256 amount) internal {
        uint256 rewardTokenBalance = address(this).balance;
        if (amount > rewardTokenBalance) {
            to.transfer(rewardTokenBalance);
        } else {
            to.transfer(amount);
        }
    }

    /**
     * @notice Internal function that updates rewards end timestamp based on rewards per second and the balance of the contract
     */
    function _setRewardsEndTimestamp() internal {
        if(rewardsPerSecond > 0) {
            uint256 rewardFromTimestamp = block.timestamp >= startTimestamp ? block.timestamp : startTimestamp;
            uint256 newEndTimestamp = rewardFromTimestamp.add(address(this).balance.div(rewardsPerSecond));
            if(newEndTimestamp > rewardFromTimestamp && newEndTimestamp != endTimestamp) {
                emit ChangedRewardsEndTimestamp(endTimestamp, newEndTimestamp);
                endTimestamp = newEndTimestamp;
            }
        }
    }
}