// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface IMasterYak {
    struct PoolInfo {
        address token;
        uint256 allocPoint;
        uint256 lastRewardTimestamp;
        uint256 accRewardsPerShare;
        uint256 totalStaked;
        bool vpForDeposit;
    }

    struct UserInfo {
        uint256 amount;
        uint256 rewardTokenDebt;
    }

    function lockManager() external view returns (address);
    function rewardsPerSecond() external view returns (uint256);
    function poolInfo(uint256 pid) external view returns (PoolInfo memory);
    function userInfo(uint256 pid, address user) external view returns (UserInfo memory);
    function pendingRewards(uint256 pid, address user) external view returns (uint256);
    function totalAllocPoint() external view returns (uint256);
    function startTimestamp() external view returns (uint256);
    function endTimestamp() external view returns (uint256);
    function deposit(uint256 pid, uint256 amount) external;
    function withdraw(uint256 pid, uint256 amount) external;
}