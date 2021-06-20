// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "../lib/VotingPowerFormula.sol";
import "../lib/SafeMath.sol";

/**
 * @title YakFormula
 * @dev Convert YAK to voting power
 */
contract YakFormula is VotingPowerFormula {
    using SafeMath for uint256;

    /**
     * @notice Convert YAK amount to voting power
     * @dev Always converts 1,000-1
     * @param amount token amount
     * @return voting power amount
     */
    function convertTokensToVotingPower(uint256 amount) external pure override returns (uint256) {
        return amount.mul(1000);
    }
}