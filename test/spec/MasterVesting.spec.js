const { expect } = require("chai");
const { ethers } = require("hardhat");
const { rewardsFixture } = require("../fixtures")

const MASTER_YAK_ALLOC_POINTS = process.env.MASTER_YAK_ALLOC_POINTS
const INITIAL_AVAX_REWARDS_BALANCE = process.env.INITIAL_AVAX_REWARDS_BALANCE

describe("MasterVesting", function() {
    let yakToken
    let wavaxToken
    let masterVesting
    let masterYak
    let votingPower
    let lockManager
    let deployer
    let alice
    let bob
    let ZERO_ADDRESS

    beforeEach(async () => {
        const fix = await rewardsFixture()
        yakToken = fix.yakToken
        wavaxToken = fix.wavaxToken
        masterVesting = fix.masterVesting
        masterYak = fix.masterYak
        votingPower = fix.votingPower
        lockManager = fix.lockManager
        deployer = fix.deployer
        alice = fix.alice
        bob = fix.bob
        ZERO_ADDRESS = fix.ZERO_ADDRESS
        await masterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE})
        await masterYak.add(MASTER_YAK_ALLOC_POINTS, yakToken.address, false, true)
        expect(await masterYak.rewardsActive()).to.eq(true)
    })

    context("addGrant", async () => {
      it("creates valid grant", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 365
        let userVotesBefore = await votingPower.balanceOf(deployer.address) 
        let grantAmount = ethers.utils.parseUnits("1500")
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)
        const newGrant = await masterVesting.getTokenGrant()
        expect(newGrant[1]).to.eq(grantAmount)
        expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS)
        expect(newGrant[3]).to.eq(0)
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore.add(grantAmount.mul(1000)))
        expect(await yakToken.balanceOf(masterVesting.address)).to.eq(0)
        let userInfo = await masterYak.userInfo("0", masterVesting.address);
        expect(userInfo.amount).to.eq(grantAmount);
      })

      it("does not allow non-owner to create a grant", async function() {
        await yakToken.connect(bob).approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 365
        let totalVested = await yakToken.balanceOf(masterVesting.address)
        let userVotesBefore = await votingPower.balanceOf(deployer.address)
        let grantAmount = ethers.utils.parseUnits("1500")
        await expect(masterVesting.connect(bob).addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: not owner")
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(masterVesting.address)).to.eq(totalVested)
        const emptyGrant = await masterVesting.getTokenGrant()
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
        let userInfo = await masterYak.userInfo("0", masterVesting.address);
        expect(userInfo.amount).to.eq(0);
      })

      it("does not allow a grant with a duration of 0", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 0
        let totalVested = await yakToken.balanceOf(masterVesting.address)
        let userVotesBefore = await votingPower.balanceOf(deployer.address) 
        let grantAmount = ethers.utils.parseUnits("1500")
        await expect(masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: duration must be > 0")
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(masterVesting.address)).to.eq(totalVested)
        const emptyGrant = await masterVesting.getTokenGrant()
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })

      it("does not allow a grant with a duration of > 1 year", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 366
        let totalVested = await yakToken.balanceOf(masterVesting.address)
        let userVotesBefore = await votingPower.balanceOf(deployer.address) 
        let grantAmount = ethers.utils.parseUnits("1500")
        await expect(masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: duration more than 1 year")
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(masterVesting.address)).to.eq(totalVested)
        const emptyGrant = await masterVesting.getTokenGrant()
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })

      it("does not allow two grants", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 365
        let userVotesBefore = await votingPower.balanceOf(deployer.address) 
        let grantAmount = ethers.utils.parseUnits("1500")
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)
        const newGrant = await masterVesting.getTokenGrant()
        expect(newGrant[1]).to.eq(grantAmount)
        expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS)
        expect(newGrant[3]).to.eq(0)
        let userVotesAfter = userVotesBefore.add(grantAmount.mul(1000))
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesAfter)
        expect(await yakToken.balanceOf(masterVesting.address)).to.eq(0)
        let userInfo = await masterYak.userInfo("0", masterVesting.address);
        expect(userInfo.amount).to.eq(grantAmount);
        await expect(masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: grant already exists for account")
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesAfter)
        const existingGrant = await masterVesting.getTokenGrant()
        expect(existingGrant[1]).to.eq(grantAmount)
        expect(existingGrant[2]).to.eq(VESTING_DURATION_IN_DAYS)
        expect(existingGrant[3]).to.eq(0)
        expect(await yakToken.balanceOf(masterVesting.address)).to.eq(0)
        userInfo = await masterYak.userInfo("0", masterVesting.address);
        expect(userInfo.amount).to.eq(grantAmount);
      })

      it("does not allow a grant of 0", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 365
        let totalVested = await yakToken.balanceOf(masterVesting.address)
        let userVotesBefore = await votingPower.balanceOf(deployer.address) 
        let grantAmount = ethers.utils.parseUnits("0")
        await expect(masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: amountVestedPerDay > 0")
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(masterVesting.address)).to.eq(totalVested)
        const emptyGrant = await masterVesting.getTokenGrant()
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })

      it("does not allow a grant where tokens vested per day < 1", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 365
        let totalVested = await yakToken.balanceOf(masterVesting.address)
        let userVotesBefore = await votingPower.balanceOf(deployer.address) 
        let grantAmount = ethers.BigNumber.from(3)
        await expect(masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Vest::addTokenGrant: amountVestedPerDay > 0")
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(masterVesting.address)).to.eq(totalVested)
        const emptyGrant = await masterVesting.getTokenGrant()
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })

      it("does not allow a grant when owner has insufficient balance", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        await yakToken.transfer(bob.address, await yakToken.balanceOf(deployer.address))
        const VESTING_DURATION_IN_DAYS = 365
        let totalVested = await yakToken.balanceOf(masterVesting.address)
        let userVotesBefore = await votingPower.balanceOf(deployer.address) 
        let grantAmount = ethers.utils.parseUnits("1500");
        await expect(masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)).to.revertedWith("revert Yak::_transferTokens: transfer exceeds from balance")
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore)
        expect(await yakToken.balanceOf(masterVesting.address)).to.eq(totalVested)
        const emptyGrant = await masterVesting.getTokenGrant()
        expect(emptyGrant[0]).to.eq(0)
        expect(emptyGrant[1]).to.eq(0)
        expect(emptyGrant[2]).to.eq(0)
        expect(emptyGrant[3]).to.eq(0)
      })
    })

    context("calculateGrantClaim", async () => {

      it("returns total grant if after duration and none claimed", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 365
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1500")
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)
        const { startTime } = await masterVesting.getTokenGrant();
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + VESTING_DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        expect(await masterVesting.calculateGrantClaim()).to.eq(grantAmount)
      })

      it("returns remaining grant if after duration and some claimed", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 365
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1500")
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)
        const { startTime } = await masterVesting.getTokenGrant();
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + 60])
        await masterVesting.claimVestedTokens()
        let amountClaimed = await masterVesting.claimedBalance()
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + VESTING_DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        expect(await masterVesting.calculateGrantClaim()).to.eq(grantAmount.sub(amountClaimed))
      })

      it("returns zero if after duration and all claimed", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 365
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1500")
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS)
        const { startTime } = await masterVesting.getTokenGrant();
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + VESTING_DURATION_IN_SECS])
        await masterVesting.claimVestedTokens()
        expect(await masterVesting.calculateGrantClaim()).to.eq(0)
        expect(await masterVesting.claimedBalance()).to.eq(grantAmount);
      })
    })

    context("vestedBalance", async () => {
      it("returns total grant if after duration and none claimed", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 365
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1500")
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS);
        const { startTime } = await masterVesting.getTokenGrant();
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + VESTING_DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        expect(await masterVesting.vestedBalance()).to.eq(grantAmount)
      })

      it("returns total grant if after duration and some claimed", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256)
        const VESTING_DURATION_IN_DAYS = 365
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60
        let grantAmount = ethers.utils.parseUnits("1500")
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS);
        const { startTime } = await masterVesting.getTokenGrant();
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + 60])
        await masterVesting.claimVestedTokens()
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + VESTING_DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        expect(await masterVesting.vestedBalance()).to.eq(grantAmount)
      })
    })

    context("harvestRewards", async () => {
      it("allows owner to harvest rewards during vesting period", async function () {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256);
        const VESTING_DURATION_IN_DAYS = 365
        let grantAmount = ethers.utils.parseUnits("1500")
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS);
        let yakTokenBalanceBefore = await yakToken.balanceOf(deployer.address);
        let avaxDeployerBalanceBefore = await ethers.provider.getBalance(deployer.address);
        let avaxContractBalanceBefore = await ethers.provider.getBalance(masterYak.address);
        let userVotesBefore = await votingPower.balanceOf(deployer.address)
        const { startTime } = await masterVesting.getTokenGrant();
        let duration = 86400;
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + duration]);
        let rewardsPerSecond = await masterYak.rewardsPerSecond();
        const tx = await masterVesting.harvest();
        const txReceipt = await tx.wait(0);
        const gasSpent = txReceipt.gasUsed.mul(tx.gasPrice);
        let expectedRewards = rewardsPerSecond.mul(duration);
        let { rewardTokenDebt } = await masterYak.userInfo("0", masterVesting.address);
        expect(rewardTokenDebt).to.eq(expectedRewards);
        expect(await ethers.provider.getBalance(deployer.address)).to.eq(avaxDeployerBalanceBefore.add(expectedRewards).sub(gasSpent));
        expect(await yakToken.balanceOf(deployer.address)).to.eq(yakTokenBalanceBefore);
        expect(await ethers.provider.getBalance(masterYak.address)).to.eq(avaxContractBalanceBefore.sub(expectedRewards));
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore);
      })

      it("does not allow non-owner to harvest rewards", async function () {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256);
        const VESTING_DURATION_IN_DAYS = 365
        let grantAmount = ethers.utils.parseUnits("1500")
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS);
        let yakTokenBalanceBefore = await yakToken.balanceOf(deployer.address);
        let avaxDeployerBalanceBefore = await ethers.provider.getBalance(deployer.address);
        let wavaxDeployerBalanceBefore = await wavaxToken.balanceOf(deployer.address);
        let wavaxContractBalanceBefore = await wavaxToken.balanceOf(masterYak.address);
        let userVotesBefore = await votingPower.balanceOf(deployer.address)
        const { startTime } = await masterVesting.getTokenGrant();
        let duration = 86400;
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + duration]);
        await expect(masterVesting.connect(bob).harvest()).to.be.revertedWith("revert Vest::harvest: not owner");
        let { rewardTokenDebt } = await masterYak.userInfo("0", masterVesting.address);
        expect(rewardTokenDebt).to.eq(0);
        expect(await ethers.provider.getBalance(deployer.address)).to.eq(avaxDeployerBalanceBefore);
        expect(await wavaxToken.balanceOf(deployer.address)).to.eq(wavaxDeployerBalanceBefore);
        expect(await yakToken.balanceOf(deployer.address)).to.eq(yakTokenBalanceBefore);
        expect(await wavaxToken.balanceOf(masterYak.address)).to.eq(wavaxContractBalanceBefore);
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore);
      })
    })

    context("claimVestedTokens", async () => {
      it("allows owner to claim vested tokens", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256);
        const VESTING_DURATION_IN_DAYS = 365;
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
        let grantAmount = ethers.utils.parseUnits("1500");
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS);
        let deployerBalance = await yakToken.balanceOf(deployer.address);
        let masterYakBalance = await yakToken.balanceOf(masterYak.address);
        let masterVestingBalance = await yakToken.balanceOf(masterVesting.address);
        let userVotesBefore = await votingPower.balanceOf(deployer.address)
        const { startTime } = await masterVesting.getTokenGrant();
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + VESTING_DURATION_IN_SECS]);
        await ethers.provider.send("evm_mine")
        expect(await masterVesting.calculateGrantClaim()).to.eq(grantAmount);
        await masterVesting.claimVestedTokens();
        expect(await yakToken.balanceOf(deployer.address)).to.eq(deployerBalance.add(grantAmount));
        expect(await yakToken.balanceOf(masterYak.address)).to.eq(masterYakBalance.sub(grantAmount));
        expect(await yakToken.balanceOf(masterVesting.address)).to.eq(masterVestingBalance);
        expect(await masterVesting.calculateGrantClaim()).to.eq(0);
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore.sub(grantAmount.mul("1000")));
      })

      it("does not allow owner to claim if no tokens have vested", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256);
        const VESTING_DURATION_IN_DAYS = 365;
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
        let grantAmount = ethers.utils.parseUnits("1500");
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS);
        const { startTime } = await masterVesting.getTokenGrant();
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + VESTING_DURATION_IN_SECS]);
        await ethers.provider.send("evm_mine")
        expect(await masterVesting.calculateGrantClaim()).to.eq(grantAmount);
        await masterVesting.claimVestedTokens();
        expect(await masterVesting.calculateGrantClaim()).to.eq(0);
        await expect(masterVesting.claimVestedTokens()).to.revertedWith("revert Vest::claimVested: amountVested is 0");
      })

      xit("allows owner to claim vested tokens multiple times", async function() {
        await yakToken.approve(masterVesting.address, ethers.constants.MaxUint256);
        const VESTING_DURATION_IN_DAYS = 365;
        const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
        let grantAmount = ethers.utils.parseUnits("1500");
        await masterVesting.addTokenGrant(grantAmount, VESTING_DURATION_IN_DAYS);
        let yakDeployerBalanceBefore = await yakToken.balanceOf(deployer.address);
        let userVotesBefore = await votingPower.balanceOf(deployer.address);
        const { startTime } = await masterVesting.getTokenGrant();
        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + VESTING_DURATION_IN_SECS / 52]);
        await masterVesting.claimVestedTokens();
        expect(await yakToken.balanceOf(deployer.address)).to.eq(yakDeployerBalanceBefore.add(grantAmount.div("52")));
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore.sub(grantAmount.div("52").mul(1000)));

        await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTime.toString()) + VESTING_DURATION_IN_SECS / 26]);
        await masterVesting.claimVestedTokens();
        expect(await yakToken.balanceOf(deployer.address)).to.eq(yakDeployerBalanceBefore.add(grantAmount.div("26")));
        expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore.sub(grantAmount.div("26").mul(1000)));
      })
    })

    context("setLockManager", async () => {

      it("allows owner to set valid lock manager contract", async function() {
        await masterVesting.setLockManager(alice.address)
        expect(await masterVesting.lockManager()).to.eq(alice.address)
      });

      it("does not allow non-owner to set lock manager contract", async function() {
        await expect(masterVesting.connect(alice).setLockManager(alice.address)).to.revertedWith("revert Vest::setLockManager: not owner")
        expect(await masterVesting.lockManager()).to.eq(lockManager.address)
      });
    });

    context("changeOwner", async () => {

      it("allows owner to set new valid owner", async function() {
        await masterVesting.changeOwner(alice.address)
        expect(await masterVesting.owner()).to.eq(alice.address)
      })

      it("does not allow non-owner to change owner", async function() {
        await expect(masterVesting.connect(alice).changeOwner(bob.address)).to.revertedWith("revert Vest::changeOwner: not owner")
        expect(await masterVesting.owner()).to.eq(deployer.address)
      })

      it("does not allow owner to set invalid owner", async function() {
        await expect(masterVesting.changeOwner(ZERO_ADDRESS)).to.revertedWith("revert Vest::changeOwner: not valid address")
        await expect(masterVesting.changeOwner(masterVesting.address)).to.revertedWith("revert Vest::changeOwner: not valid address")
        await expect(masterVesting.changeOwner(yakToken.address)).to.revertedWith("revert Vest::changeOwner: not valid address")
        await expect(masterVesting.changeOwner(masterYak.address)).to.revertedWith("revert Vest::changeOwner: not valid address")
        expect(await masterVesting.owner()).to.eq(deployer.address)
      })
    })
})
