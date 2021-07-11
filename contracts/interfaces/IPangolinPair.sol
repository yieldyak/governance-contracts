// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface IPangolinPair {
    function balanceOf(address) external view returns (uint256);
    function approve(address spender, uint value) external returns (bool);
    function token0() external view returns (address);
    function token1() external view returns (address);
}