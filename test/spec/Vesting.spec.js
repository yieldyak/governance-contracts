const { expect } = require("chai");
const fs = require('fs')
const { ethers, network } = require("hardhat");
const { governanceFixture } = require("../fixtures")

describe("Vesting", function() {
    let yakToken
    let vesting
    let votingPower
    let votingPowerPrism
    let votingPowerImplementation
    let lockManager
    let deployer
    let alice
    let bob
    let ZERO_ADDRESS

    beforeEach(async () => {
        const fix = await governanceFixture()
        yakToken = fix.yakToken
        vesting = fix.vesting
        votingPower = fix.votingPower
        votingPowerPrism = fix.votingPowerPrism
        votingPowerImplementation = fix.votingPowerImplementation
        lockManager = fix.lockManager
        deployer = fix.deployer
        alice = fix.alice
        bob = fix.bob
        ZERO_ADDRESS = fix.ZERO_ADDRESS
        await votingPowerPrism.setPendingProxyImplementation(votingPowerImplementation.address)
        await votingPowerImplementation.become(votingPowerPrism.address)
    })

  context("Pre-Init", async () => {
    context("setVotingPowerContract", async () => {
        xit("reverts", async function() {
            await expect(vesting.setVotingPowerContract(votingPower.address)).to.revertedWith("Vest::setVotingPowerContract: voting power not initialized")
        })
    })
  })

  context("Post-Init", async () => {
    beforeEach(async () => {
        // await votingPower.initialize(yakToken.address)
        // await lockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), vesting.address)
    })

    context("addGrant", async () => {
      it("creates valid grant", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const START_TIME = parseInt(Date.now() / 1000) + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let totalVested = await yakToken.balanceOf(vesting.address)
        let userVotesBefore = await votingPower.balanceOf(alice.address) 
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        const newGrant = await vesting.getTokenGrant(alice.address)
        expect(newGrant[0]).to.eq(START_TIME)
        expect(newGrant[1]).to.eq(grantAmount)
        expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS)
        expect(newGrant[3]).to.eq(0)
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotesBefore.add(grantAmount.mul(1000)))
        totalVested = totalVested.add(grantAmount)
        expect(await yakToken.balanceOf(vesting.address)).to.eq(totalVested)
      })

      xit("creates valid grants from file", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const tokenGrants = JSON.parse(fs.readFileSync(`./grants/${network.name}.json`, 'utf-8'))
        let decimals = await yakToken.decimals()
        const START_TIME = parseInt(Date.now() / 1000) + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let totalVested = await yakToken.balanceOf(vesting.address)

        for(const grant of tokenGrants) {
            let userVotesBefore = await votingPower.balanceOf(grant.recipient) 
            let grantAmount = ethers.BigNumber.from(parseInt(grant.amount * 100)).mul(ethers.BigNumber.from(10).pow(decimals)).div(100)
            await vesting.addTokenGrant(grant.recipient, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
            const newGrant = await vesting.getTokenGrant(grant.recipient)
            expect(newGrant[0]).to.eq(START_TIME)
            expect(newGrant[1]).to.eq(grantAmount)
            expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS)
            expect(newGrant[3]).to.eq(0)
            expect(await votingPower.balanceOf(grant.recipient)).to.eq(userVotesBefore.add(grantAmount.mul(1000)))
            totalVested = totalVested.add(grantAmount)
        }
        
        expect(await yakToken.balanceOf(vesting.address)).to.eq(totalVested)
      })

      it("does not allow non-owner to create a grant", async function() {
        await yakToken.connect(bob).approve(vesting.address, ethers.constants.MaxUint256)
        const START_TIME = parseInt(Date.now() / 1000) + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let totalVested = await yakToken.balanceOf(vesting.address)
        let userVotesBefore = await votingPower.balanceOf(alice.address) 
        let grantAmount = ethers.utils.parseUnits("1000")
        await expect(vesting.connect(bob).addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: not owner")
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(vesting.address)).to.eq(totalVested)
        const emptyGrant = await vesting.getTokenGrant(alice.address)
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })

      it("does not allow a grant with a duration of 0", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        let decimals = await yakToken.decimals()
        const START_TIME = parseInt(Date.now() / 1000) + 21600
        const VESTING_DURATION_IN_DAYS = 0
        let totalVested = await yakToken.balanceOf(vesting.address)
        let userVotesBefore = await votingPower.balanceOf(alice.address) 
        let grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await expect(vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: duration must be > 0")
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(vesting.address)).to.eq(totalVested)
        const emptyGrant = await vesting.getTokenGrant(alice.address)
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })

      it("does not allow a grant with a duration of > 1 year", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        let decimals = await yakToken.decimals()
        const START_TIME = parseInt(Date.now() / 1000) + 21600
        const VESTING_DURATION_IN_DAYS = 366
        let totalVested = await yakToken.balanceOf(vesting.address)
        let userVotesBefore = await votingPower.balanceOf(alice.address) 
        let grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await expect(vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: duration more than 1 year")
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(vesting.address)).to.eq(totalVested)
        const emptyGrant = await vesting.getTokenGrant(alice.address)
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })

      it("does not allow a grant for an account with an existing grant", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const START_TIME = parseInt(Date.now() / 1000) + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let totalVested = await yakToken.balanceOf(vesting.address)
        let userVotesBefore = await votingPower.balanceOf(alice.address) 
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        const newGrant = await vesting.getTokenGrant(alice.address)
        expect(newGrant[0]).to.eq(START_TIME)
        expect(newGrant[1]).to.eq(grantAmount)
        expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS)
        expect(newGrant[3]).to.eq(0)
        let userVotesAfter = userVotesBefore.add(grantAmount.mul(1000))
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotesAfter)
        totalVested = totalVested.add(grantAmount)
        expect(await yakToken.balanceOf(vesting.address)).to.eq(totalVested)
        await expect(vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: grant already exists for account")
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotesAfter)
        expect(await yakToken.balanceOf(vesting.address)).to.eq(totalVested)
        const existingGrant = await vesting.getTokenGrant(alice.address)
        expect(existingGrant[0]).to.eq(START_TIME)
        expect(existingGrant[1]).to.eq(grantAmount)
        expect(existingGrant[2]).to.eq(VESTING_DURATION_IN_DAYS)
        expect(existingGrant[3]).to.eq(0)
      })

      it("does not allow a grant of 0", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const START_TIME = parseInt(Date.now() / 1000) + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let totalVested = await yakToken.balanceOf(vesting.address)
        let userVotesBefore = await votingPower.balanceOf(alice.address) 
        let grantAmount = ethers.BigNumber.from(0)
        await expect(vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: amountVestedPerDay > 0")
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(vesting.address)).to.eq(totalVested)
        const emptyGrant = await vesting.getTokenGrant(alice.address)
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })

      it("does not allow a grant where tokens vested per day < 1", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const START_TIME = parseInt(Date.now() / 1000) + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let totalVested = await yakToken.balanceOf(vesting.address)
        let userVotesBefore = await votingPower.balanceOf(alice.address) 
        let grantAmount = ethers.BigNumber.from(3)
        await expect(vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: amountVestedPerDay > 0")
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(vesting.address)).to.eq(totalVested)
        const emptyGrant = await vesting.getTokenGrant(alice.address)
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })

      it("does not allow a grant when owner has insufficient balance", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        await yakToken.transfer(bob.address, await yakToken.balanceOf(deployer.address))
        let decimals = await yakToken.decimals()
        const START_TIME = parseInt(Date.now() / 1000) + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let totalVested = await yakToken.balanceOf(vesting.address)
        let userVotesBefore = await votingPower.balanceOf(alice.address) 
        let grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await expect(vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Yak::_transferTokens: transfer exceeds from balance")
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(vesting.address)).to.eq(totalVested)
        const emptyGrant = await vesting.getTokenGrant(alice.address)
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })
    })

    context("calculateGrantClaim", async () => {
      it("returns 0 before grant start time", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        expect(await vesting.calculateGrantClaim(alice.address)).to.eq(0)
      })

      it("returns 0 before grant cliff", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        let decimals = await yakToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 21600])
        await ethers.provider.send("evm_mine")
        expect(await vesting.calculateGrantClaim(alice.address)).to.eq(0)
      })

      it("returns total grant if after duration and none claimed", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 21600 + VESTING_DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        expect(await vesting.calculateGrantClaim(alice.address)).to.eq(grantAmount)
      })

      it("returns remaining grant if after duration and some claimed", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + 60])
        await vesting.claimVestedTokens(alice.address)
        let amountClaimed = await vesting.claimedBalance(alice.address)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + VESTING_DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        expect(await vesting.calculateGrantClaim(alice.address)).to.eq(grantAmount.sub(amountClaimed))
      })


      it("returns claimable balance if after cliff and none claimed", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        let newTime = timestamp + 21600 + 60
        await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        await ethers.provider.send("evm_mine")
        let elapsedTime = newTime - START_TIME
        expect(await vesting.calculateGrantClaim(alice.address)).to.eq(grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime))
      })

      it("returns claimable balance if after cliff and some claimed", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        let newTime = timestamp + 21600 + 60
        await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        await ethers.provider.send("evm_mine")        
        await vesting.claimVestedTokens(alice.address)
        let amountClaimed = await vesting.claimedBalance(alice.address)
        newTime = timestamp + 21600 + 60 + 60
        await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        await ethers.provider.send("evm_mine")
        let elapsedTime = newTime - START_TIME
        expect(await vesting.calculateGrantClaim(alice.address)).to.eq(grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime).sub(amountClaimed))
      })
    })

    context("vestedBalance", async () => {
      it("returns 0 before grant start time", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        expect(await vesting.vestedBalance(alice.address)).to.eq(0)
      })

      it("returns total grant if after duration and none claimed", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + VESTING_DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        expect(await vesting.vestedBalance(alice.address)).to.eq(grantAmount)
      })

      it("returns total grant if after duration and some claimed", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + 60])
        await vesting.claimVestedTokens(alice.address)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + VESTING_DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        expect(await vesting.vestedBalance(alice.address)).to.eq(grantAmount)
      })


      xit("returns vested balance if after cliff and none claimed", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        let newTime = timestamp + 21600 + 60
        await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        await ethers.provider.send("evm_mine")
        let elapsedTime = newTime - START_TIME
        expect(await vesting.vestedBalance(alice.address)).to.eq(grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime))
      })

      xit("returns vested balance if after cliff and some claimed", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        let newTime = timestamp + 21600 + 60
        await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        await ethers.provider.send("evm_mine")        
        await vesting.claimVestedTokens(alice.address)
        newTime = timestamp + 21600 + 60 + 60
        await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        await ethers.provider.send("evm_mine")
        let elapsedTime = newTime - START_TIME
        expect(await vesting.vestedBalance(alice.address)).to.eq(grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime))
      })
    })

    context("claimVestedTokens", async () => {
      it("does not allow user to claim if no tokens have vested", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        let decimals = await yakToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        await expect(vesting.claimVestedTokens(alice.address)).to.revertedWith("revert Vest::claimVested: amountVested is 0")
      })

      it("allows user to claim vested tokens once", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        const userVotingPowerBefore = await votingPower.balanceOf(alice.address)
        expect(userVotingPowerBefore).to.eq(grantAmount.mul(1000))
        let newTime = timestamp + 21600 + 60
        let elapsedTime = newTime - START_TIME
        let claimAmount = grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime)
        let userTokenBalanceBefore = await yakToken.balanceOf(alice.address)
        let contractTokenBalanceBefore = await yakToken.balanceOf(vesting.address)
        await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        await vesting.claimVestedTokens(alice.address)
        expect(await vesting.claimedBalance(alice.address)).to.eq(claimAmount)
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotingPowerBefore.sub(claimAmount.mul(1000)))
        expect(await yakToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(claimAmount))
        expect(await yakToken.balanceOf(vesting.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount))
      })

      it("allows user to claim vested tokens multiple times", async function() {
        await yakToken.approve(vesting.address, ethers.constants.MaxUint256)
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const VESTING_DURATION_IN_DAYS = 4
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1000")
        await vesting.addTokenGrant(alice.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS)
        const userVotingPowerBefore = await votingPower.balanceOf(alice.address)
        expect(userVotingPowerBefore).to.eq(grantAmount.mul(1000))
        let newTime = timestamp + 21600 + 60
        let elapsedTime = newTime - START_TIME
        let claimAmount = grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime)
        let userTokenBalanceBefore = await yakToken.balanceOf(alice.address)
        let contractTokenBalanceBefore = await yakToken.balanceOf(vesting.address)
        await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        await vesting.claimVestedTokens(alice.address)
        expect(await vesting.claimedBalance(alice.address)).to.eq(claimAmount)
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotingPowerBefore.sub(claimAmount.mul(1000)))
        expect(await yakToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(claimAmount))
        expect(await yakToken.balanceOf(vesting.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount))

        newTime = timestamp + 21600 + 60 + 60
        elapsedTime = newTime - START_TIME
        let newClaimAmount = grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime).sub(claimAmount)
        userTokenBalanceBefore = await yakToken.balanceOf(alice.address)
        contractTokenBalanceBefore = await yakToken.balanceOf(vesting.address)
        await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        await vesting.claimVestedTokens(alice.address)
        expect(await vesting.claimedBalance(alice.address)).to.eq(claimAmount.add(newClaimAmount))
        expect(await votingPower.balanceOf(alice.address)).to.eq(userVotingPowerBefore.sub(claimAmount.mul(1000)).sub(newClaimAmount.mul(1000)))
        expect(await yakToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(newClaimAmount))
        expect(await yakToken.balanceOf(vesting.address)).to.eq(contractTokenBalanceBefore.sub(newClaimAmount))
      })
    })

    context("setLockManager", async () => {

      it("allows owner to set valid lock manager contract", async function() {
        await vesting.setLockManager(alice.address)
        expect(await vesting.lockManager()).to.eq(alice.address)
      });

      it("does not allow non-owner to set lock manager contract", async function() {
        await expect(vesting.connect(alice).setLockManager(alice.address)).to.revertedWith("revert Vest::setLockManager: not owner")
        expect(await vesting.lockManager()).to.eq(lockManager.address)
      });
    });

    context("changeOwner", async () => {

      it("allows owner to set new valid owner", async function() {
        await vesting.changeOwner(alice.address)
        expect(await vesting.owner()).to.eq(alice.address)
      })

      it("does not allow non-owner to change owner", async function() {
        await expect(vesting.connect(alice).changeOwner(bob.address)).to.revertedWith("revert Vest::changeOwner: not owner")
        expect(await vesting.owner()).to.eq(deployer.address)
      })

      it("does not allow owner to set invalid owner", async function() {
        await expect(vesting.changeOwner(ZERO_ADDRESS)).to.revertedWith("revert Vest::changeOwner: not valid address")
        await expect(vesting.changeOwner(vesting.address)).to.revertedWith("revert Vest::changeOwner: not valid address")
        await expect(vesting.changeOwner(yakToken.address)).to.revertedWith("revert Vest::changeOwner: not valid address")
        expect(await vesting.owner()).to.eq(deployer.address)
      })
    })
  })
})
