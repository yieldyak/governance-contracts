# $YAK

The YAK token has not been deployed.

## Token Description

YAK is an ERC-20 compliant token. The contract logic is immutable and includes no ability to mint tokens, burn tokens or otherwise change supply.

* Name: `YAK Token`
* Symbol: `YAK`
* Decimals: `18`
* Total supply: `10,000 YAK`

## Token Distribution

The token will be initially distributed through the `Claim` contract.

## Token Utility

$YAK token has two main purposes:

1. Govern Yield Yak network
2. Stake and farm to earn rewards

Farming and governance are considered together. That is, users do not need to decide between having a voice in governance and earning yield farming incentives. They can have both. In fact, users **must** stake tokens to be eligible to vote.

# Governance

Staked YAK tokens contribute to voting power. The vision for the platform is to be fully governed on-chain. Network architecture decisions should be made with this ultimate goal in mind.

## Multi-sig and Snapshot Voting

Initially, and for the goal of growing the network in a flexible way, a multi-sig wallet will be used to execute key governance decisions. DAO members may signal their preferences through Snapshot voting.

## Voting Power

We introduce the concept of Voting Power, which is determined by deposits into the staking contract. The staking contract accepts multiple types of tokens, with different ratios of votes per token. For example:

* $YAK token - 1 vote per token
* LP token - 10 votes per token
* YRT token - 50 votes per token

#### Storage and Implementation

The `VotingPowerPrism` contract stores all snapshots and should be referenced by contracts which need access to snapshots.

This proxy contract delegates execution to `VotingPower`, an upgradable implementation contract.

The `LockManager` contract gives other contracts in the ecosystem the ability to modify user's voting power. For example, vesting tokens have voting power. For example, farming tokens have voting power.

#### Formulas and Registry

Conversion ratios are determined by contracts (see `/contracts/formulas/`) which may be updated.

Tokens eligible for voting power may be added and removed through the `TokenRegistry` contract.
