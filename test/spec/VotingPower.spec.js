const { expect } = require("chai");
const { ethers } = require("hardhat");
const { governanceFixture } = require("../fixtures")
const { ecsign } = require("ethereumjs-util")

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY

const DOMAIN_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
)

const PERMIT_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

describe("VotingPower", function() {
    let yakToken
    let votingPower
    let votingPowerPrism
    let votingPowerImplementation
    let deployer
    let alice
    let bob
    let ZERO_ADDRESS

    beforeEach(async () => {
        const fix = await governanceFixture()
        yakToken = fix.yakToken
        votingPower = fix.votingPower
        votingPowerPrism = fix.votingPowerPrism
        votingPowerImplementation = fix.votingPowerImplementation
        deployer = fix.deployer
        alice = fix.alice
        bob = fix.bob
        ZERO_ADDRESS = fix.ZERO_ADDRESS
    })

    context("Post-Init", async () => {
        
        context("setup", async () => {
            it("returns the current YAK token address", async function() {
                expect(await votingPower.yakToken()).to.eq(yakToken.address)
                expect(await votingPowerImplementation.yakToken()).to.eq(ZERO_ADDRESS)
            })

            it("returns the correct decimals for voting power", async function() {
                expect(await votingPower.decimals()).to.eq(18)
            })
        })

        context("stake", async () => {
            it("allows a valid stake", async function() {
                const userBalanceBefore = await yakToken.balanceOf(deployer.address)
                const contractBalanceBefore = await yakToken.balanceOf(votingPower.address)
                const totalYakStakedBefore = await votingPower.getAmountStaked(deployer.address, yakToken.address)
                const userVotesBefore = await votingPower.balanceOf(deployer.address)
                const amountToStake = ethers.utils.parseUnits("100");
                await yakToken.approve(votingPower.address, amountToStake)
                await votingPower.stake(yakToken.address, amountToStake);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(amountToStake))
                expect(await yakToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore.add(amountToStake))
                expect(await votingPower.getAmountStaked(deployer.address, yakToken.address)).to.eq(totalYakStakedBefore.add(amountToStake))
                expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore.add(amountToStake.mul(1000)))
            });

            it("does not allow a zero stake amount", async function() {
                await expect(votingPower.stake(yakToken.address, 0)).to.revertedWith("revert VP::stake: cannot stake 0")
            });

            it("does not allow a user to stake more tokens than they have", async function() {
                const amountToStake = ethers.utils.parseUnits("100");
                await expect(votingPower.connect(alice).stake(yakToken.address, amountToStake)).to.revertedWith("revert VP::stake: not enough tokens")
            });

            it("does not allow a user to stake before approval", async function() {
                const amountToStake = ethers.utils.parseUnits("100");
                await expect(votingPower.stake(yakToken.address, amountToStake)).to.revertedWith("revert VP::stake: must approve tokens before staking")
            });
        });

        context("stakeWithPermit", async () => {
            it("allows a valid stake with permit", async function() {
                const value = ethers.utils.parseUnits("100");
                const userBalanceBefore = await yakToken.balanceOf(deployer.address)
                const contractBalanceBefore = await yakToken.balanceOf(votingPower.address)
                const totalYakStakedBefore = await votingPower.getAmountStaked(deployer.address, yakToken.address)
                const userVotesBefore = await votingPower.balanceOf(deployer.address)
                
                const domainSeparator = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                        [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await yakToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, yakToken.address]
                    )
                )
          
                const nonce = await yakToken.nonces(deployer.address)
                const deadline = ethers.constants.MaxUint256
                const digest = ethers.utils.keccak256(
                    ethers.utils.solidityPack(
                        ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                        [
                        '0x19',
                        '0x01',
                        domainSeparator,
                        ethers.utils.keccak256(
                            ethers.utils.defaultAbiCoder.encode(
                            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                            [PERMIT_TYPEHASH, deployer.address, votingPower.address, value, nonce, deadline]
                            )
                        ),
                        ]
                    )
                )
        
                const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
                await votingPower.stakeWithPermit(value, deadline, v, r, s)
                expect(await yakToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(value))
                expect(await yakToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore.add(value))
                expect(await votingPower.getAmountStaked(deployer.address, yakToken.address)).to.eq(totalYakStakedBefore.add(value))
                expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore.add(value.mul(1000)))
            })

            it("does not allow a zero stake amount", async function() {
                const value = 0
                const domainSeparator = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                        [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await yakToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, yakToken.address]
                    )
                )
          
                  
                const nonce = await yakToken.nonces(deployer.address)
                const deadline = ethers.constants.MaxUint256
                const digest = ethers.utils.keccak256(
                    ethers.utils.solidityPack(
                        ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                        [
                        '0x19',
                        '0x01',
                        domainSeparator,
                        ethers.utils.keccak256(
                            ethers.utils.defaultAbiCoder.encode(
                            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                            [PERMIT_TYPEHASH, deployer.address, votingPower.address, value, nonce, deadline]
                            )
                        ),
                        ]
                    )
                )
        
                const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
                await expect(votingPower.stakeWithPermit(value, deadline, v, r, s)).to.revertedWith("revert VP::stakeWithPermit: cannot stake 0")
            })

            it("does not allow a user to stake using a permit signed by someone else", async function() {
                const value = ethers.utils.parseUnits("100");
                const domainSeparator = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                        [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await yakToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, yakToken.address]
                    )
                )
          
                  
                const nonce = await yakToken.nonces(alice.address)
                const deadline = ethers.constants.MaxUint256
                const digest = ethers.utils.keccak256(
                    ethers.utils.solidityPack(
                        ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                        [
                        '0x19',
                        '0x01',
                        domainSeparator,
                        ethers.utils.keccak256(
                            ethers.utils.defaultAbiCoder.encode(
                            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                            [PERMIT_TYPEHASH, alice.address, votingPower.address, value, nonce, deadline]
                            )
                        ),
                        ]
                    )
                )
        
                const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
                await expect(votingPower.stakeWithPermit(value, deadline, v, r, s)).to.revertedWith("revert Yak::validateSig: invalid signature")
            })

            it("does not allow a user to stake more tokens than they have", async function() {
                const value = ethers.utils.parseUnits("100");
                const domainSeparator = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                        [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await yakToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, yakToken.address]
                    )
                )
          
                  
                const nonce = await yakToken.nonces(alice.address)
                const deadline = ethers.constants.MaxUint256
                const digest = ethers.utils.keccak256(
                    ethers.utils.solidityPack(
                        ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                        [
                        '0x19',
                        '0x01',
                        domainSeparator,
                        ethers.utils.keccak256(
                            ethers.utils.defaultAbiCoder.encode(
                            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                            [PERMIT_TYPEHASH, alice.address, votingPower.address, value, nonce, deadline]
                            )
                        ),
                        ]
                    )
                )
        
                const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
                await expect(votingPower.connect(alice).stakeWithPermit(value, deadline, v, r, s)).to.revertedWith("revert VP::stakeWithPermit: not enough tokens")
            })
        })

        context("withdraw", async () => {
            it("allows a valid withdrawal", async function() {
                const userBalanceBefore = await yakToken.balanceOf(deployer.address)
                const contractBalanceBefore = await yakToken.balanceOf(votingPower.address)
                const totalYakStakedBefore = await votingPower.getAmountStaked(deployer.address, yakToken.address)
                const userVotesBefore = await votingPower.balanceOf(deployer.address)
                const amountToStake = ethers.utils.parseUnits("100");
                await yakToken.approve(votingPower.address, amountToStake)
                await votingPower.stake(yakToken.address, amountToStake)
                expect(await yakToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(amountToStake))
                expect(await yakToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore.add(amountToStake))
                expect(await votingPower.getAmountStaked(deployer.address, yakToken.address)).to.eq(totalYakStakedBefore.add(amountToStake))
                const userVotesAfter = await votingPower.balanceOf(deployer.address)
                expect(userVotesAfter).to.eq(userVotesBefore.add(amountToStake.mul(1000)))
                await votingPower.withdraw(yakToken.address, amountToStake)
                expect(await yakToken.balanceOf(deployer.address)).to.eq(userBalanceBefore)
                expect(await yakToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore)
                expect(await votingPower.getAmountStaked(deployer.address, yakToken.address)).to.eq(totalYakStakedBefore)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore)
            })

            it("does not allow a zero withdrawal amount", async function() {
                await expect(votingPower.withdraw(yakToken.address, 0)).to.revertedWith("revert VP::withdraw: cannot withdraw 0")
            })

            it("does not allow a user to withdraw more than their current stake", async function() {
                const amountToStake = ethers.utils.parseUnits("100");
                await yakToken.approve(votingPower.address, amountToStake)
                await votingPower.stake(yakToken.address, amountToStake)
                await expect(votingPower.withdraw(yakToken.address, amountToStake.add(1))).to.revertedWith("revert VP::_withdraw: not enough tokens staked")
            })
        })
    })
})
