const { expect } = require("chai")
const { ethers } = require("hardhat");
const { rewardsFixture } = require("../fixtures")

const INITIAL_WAVAX_REWARDS_BALANCE = process.env.INITIAL_WAVAX_REWARDS_BALANCE
const FACTOR = ethers.BigNumber.from("10").pow("12")

describe('RewardsManager', () => {
    let yakToken
    let wavaxToken
    let rewardsManager
    let votingPower
    let lockManager
    let deployer
    let alice
    let bob
    let startTimestamp
    let rewardsPerSecond

    beforeEach(async () => {
        const fix = await rewardsFixture()
        yakToken = fix.yakToken
        wavaxToken = fix.wavaxToken
        votingPower = fix.votingPower
        rewardsManager = fix.rewardsManager
        lockManager = fix.lockManager
        deployer = fix.deployer
        alice = fix.alice
        bob = fix.bob
        startTimestamp = await rewardsManager.startTimestamp()
        rewardsPerSecond = await rewardsManager.rewardTokensPerSecond()
    })

    context('before startTimestamp', async () => {
        context('rewardsActive', async () => {
            it('returns false if rewards period has not started', async () => {
                // const { timestamp } = ethers.provider.getBlock('latest');
                expect(await rewardsManager.rewardsActive()).to.eq(false)
                // await rewardsManager.addRewardsBalance(INITIAL_WAVAX_REWARDS_BALANCE)
                // expect(await rewardsManager.rewardsActive()).to.eq(false)
            });
        });
    });

    context('startTimestamp', async () => {
        context('rewardsActive', async () => {
            beforeEach(async () => {
                const { timestamp } = await ethers.provider.getBlock('latest')
                let numSeconds = startTimestamp.sub(timestamp)
                for(var i = 0; i < numSeconds.sub(1).toNumber(); i++) {
                    await ethers.provider.send("evm_mine")
                }
            });

            it('returns true if rewards period is active', async () => {
                expect(await rewardsManager.rewardsActive()).to.eq(false)
                await rewardsManager.addRewardsBalance(INITIAL_WAVAX_REWARDS_BALANCE)
                const ALLOC_POINTS = "10"
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, false, true)
                expect(await rewardsManager.rewardsActive()).to.eq(true)
            });
        });
    
        context('add', async () => {
            beforeEach(async () => {
                await rewardsManager.addRewardsBalance(INITIAL_WAVAX_REWARDS_BALANCE)
            });
            
            it('successfully adds a valid YAK pool w/ voting power', async () => {
                const ALLOC_POINTS = "10"
                const numPools = await rewardsManager.poolLength()
                const numTotalAllocPoints = await rewardsManager.totalAllocPoint()
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, false, true)
                expect(await rewardsManager.poolLength()).to.eq(numPools.add(1))
                expect(await rewardsManager.totalAllocPoint()).to.eq(numTotalAllocPoints.add(ALLOC_POINTS))

                const contractBal = await wavaxToken.balanceOf(rewardsManager.address)
                const rewardsPerSecond = await rewardsManager.rewardTokensPerSecond()
                const newPool = await rewardsManager.poolInfo(numPools)

                expect(newPool.token).to.eq(yakToken.address)
                expect(newPool.allocPoint).to.eq(ALLOC_POINTS)
                // expect(await rewardsManager.endTimestamp()).to.eq(startTimestamp.add(contractBal.div(rewardsPerSecond)))

                const yakBalance = await yakToken.balanceOf(deployer.address)
                await yakToken.approve(rewardsManager.address, yakBalance)
                await rewardsManager.deposit(numPools, yakBalance)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000))
            });
            
            it('reverts for a pool w/ voting power w/o a formula', async () => {
                const ALLOC_POINTS = "10"
                const WAVAX_TO_DEPOSIT = ethers.utils.parseUnits("1");
                const numPools = await rewardsManager.poolLength()
                await rewardsManager.add(ALLOC_POINTS, wavaxToken.address, false, true)

                await wavaxToken.deposit({ value: WAVAX_TO_DEPOSIT });
                await wavaxToken.approve(rewardsManager.address, WAVAX_TO_DEPOSIT)
                await expect(rewardsManager.deposit(numPools, WAVAX_TO_DEPOSIT)).to.revertedWith("LM::calculateVotingPower: token not supported")
            });
            
            it('successfully adds a valid YAK pool w/o voting power', async () => {
                const ALLOC_POINTS = "10"
                const numPools = await rewardsManager.poolLength()
                const numTotalAllocPoints = await rewardsManager.totalAllocPoint()
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, false, false)
                expect(await rewardsManager.poolLength()).to.eq(numPools.add(1))
                expect(await rewardsManager.totalAllocPoint()).to.eq(numTotalAllocPoints.add(ALLOC_POINTS))

                const contractBal = await wavaxToken.balanceOf(rewardsManager.address)
                const rewardsPerSecond = await rewardsManager.rewardTokensPerSecond()
                const newPool = await rewardsManager.poolInfo(numPools)

                expect(newPool.token).to.eq(yakToken.address)
                expect(newPool.allocPoint).to.eq(ALLOC_POINTS)
                // expect(await rewardsManager.endTimestamp()).to.eq(startTimestamp.add(contractBal.div(rewardsPerSecond)))

                const yakBalance = await yakToken.balanceOf(deployer.address)
                await yakToken.approve(rewardsManager.address, yakBalance)
                await rewardsManager.deposit(numPools, yakBalance)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0)
            });
            
            it('successfully adds a valid pool w/ voting power w/o rewards', async () => {
                const ALLOC_POINTS = "0"
                const numPools = await rewardsManager.poolLength()
                const numTotalAllocPoints = await rewardsManager.totalAllocPoint()
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, false, true)
                expect(await rewardsManager.poolLength()).to.eq(numPools.add(1))
                expect(await rewardsManager.totalAllocPoint()).to.eq(numTotalAllocPoints.add(ALLOC_POINTS))

                const contractBal = await wavaxToken.balanceOf(rewardsManager.address)
                const rewardsPerSecond = await rewardsManager.rewardTokensPerSecond()
                const newPool = await rewardsManager.poolInfo(numPools)

                expect(newPool.token).to.eq(yakToken.address)
                expect(newPool.allocPoint).to.eq(ALLOC_POINTS)
                // expect(await rewardsManager.endTimestamp()).to.eq(startTimestamp.add(contractBal.div(rewardsPerSecond)))

                const yakBalance = await yakToken.balanceOf(deployer.address)
                await yakToken.approve(rewardsManager.address, yakBalance)
                await rewardsManager.deposit(numPools, yakBalance)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000))
            });

            it('successfully adds a second and third pool', async () => {
                await rewardsManager.add("10", yakToken.address, false, true);
                await rewardsManager.add("20", yakToken.address, false, true);
                await rewardsManager.add("0", yakToken.address, false, true);
                expect(await rewardsManager.poolLength()).to.eq(3)
                expect(await rewardsManager.totalAllocPoint()).to.eq(30)
            });

            it('does not allow non-owner to add pool', async () => {
                const ALLOC_POINTS = "10"
                await expect(rewardsManager.connect(alice).add(ALLOC_POINTS, yakToken.address, true, true)).to.revertedWith("not owner")
            });
        });

        context('set', async () => {
            beforeEach(async () => {
                const ALLOC_POINTS = "10"
                await rewardsManager.addRewardsBalance(INITIAL_WAVAX_REWARDS_BALANCE)
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, true, true)
            });

            it('allows owner to set alloc points for pool', async () => {
                const ALLOC_POINTS = "20"
                const numPools = await rewardsManager.poolLength()
                const pid = numPools.sub(1)
                await rewardsManager.set(pid, ALLOC_POINTS, true)
                const pool = await rewardsManager.poolInfo(pid)
                expect(pool.allocPoint).to.eq(ALLOC_POINTS)
            });

            it('does not allow non-owner to set alloc points for pool', async () => {
                const ALLOC_POINTS = "20"
                const numPools = await rewardsManager.poolLength()
                const pid = numPools.sub(1)
                await expect(rewardsManager.connect(alice).set(pid, ALLOC_POINTS, true)).to.revertedWith("not owner")
            });
        });

        context('deposit', async () => {
            beforeEach(async () => {
                const ALLOC_POINTS = "10"
                await rewardsManager.addRewardsBalance(INITIAL_WAVAX_REWARDS_BALANCE)
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, true, true)
            });

            it('allows a user to harvest rewards by passing in zero as amount', async () => {
                const numPools = await rewardsManager.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);

                const deployerWavaxBalanceBefore = await wavaxToken.balanceOf(deployer.address);
                await yakToken.approve(rewardsManager.address, yakBalance);
                await rewardsManager.deposit(poolIndex, yakBalance);
                
                let userInfo = await rewardsManager.userInfo(poolIndex, deployer.address)

                expect(userInfo.amount).to.eq(yakBalance);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));

                const DURATION = 600;
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");

                const accRewardsPerShare = rewardsPerSecond.mul(FACTOR).mul(DURATION).div(yakBalance);
                const pendingWavax = yakBalance.mul(accRewardsPerShare).div(FACTOR);
                const amountToClaim = await rewardsManager.pendingRewardTokens(poolIndex, deployer.address);
                // expect(amountToClaim).to.be.closeTo(pendingWavax, pendingWavax.div(100));

                await rewardsManager.deposit(poolIndex, 0);

                const poolInfo = await rewardsManager.poolInfo(poolIndex);
                userInfo = await rewardsManager.userInfo(poolIndex, deployer.address);

                expect(poolInfo.totalStaked).to.eq(yakBalance);
                expect(userInfo.amount).to.eq(yakBalance);
                expect(userInfo.rewardTokenDebt).to.be.closeTo(amountToClaim, amountToClaim.div(100));
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));
                expect(await wavaxToken.balanceOf(deployer.address)).to.be.closeTo(deployerWavaxBalanceBefore.add(amountToClaim), amountToClaim.div(100));
            });
        })

        context('withdraw', async () => {
            beforeEach(async () => {
                await rewardsManager.addRewardsBalance(INITIAL_WAVAX_REWARDS_BALANCE)
            });

            it('allows a user to withdraw from a pool w/o voting power', async () => {
                const ALLOC_POINTS = "10"
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, true, false);
                const numPools = await rewardsManager.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);
                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);

                await yakToken.approve(rewardsManager.address, yakBalance);
                await rewardsManager.deposit(poolIndex, yakBalance);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);

                const DURATION = 600;
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");
                let userInfo = await rewardsManager.userInfo(poolIndex, deployer.address);
                const amountToClaim = await rewardsManager.pendingRewardTokens(poolIndex, deployer.address);
                await rewardsManager.withdraw(poolIndex, yakBalance);

                const poolInfo = await rewardsManager.poolInfo(poolIndex);
                userInfo = await rewardsManager.userInfo(poolIndex, deployer.address);
                expect(poolInfo.totalStaked).to.eq(0);
                expect(userInfo.amount).to.eq(0);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await wavaxToken.balanceOf(deployer.address)).to.be.closeTo(wavaxBalance.add(amountToClaim), amountToClaim.div(100));
            });

            it('allows a user to withdraw from a pool w/ voting power', async () => {
                const ALLOC_POINTS = "10";
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, true, true);
                const numPools = await rewardsManager.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);
                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);

                await yakToken.approve(rewardsManager.address, yakBalance);
                await rewardsManager.deposit(poolIndex, yakBalance);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));

                const DURATION = 600;
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");
                let userInfo = await rewardsManager.userInfo(poolIndex, deployer.address);
                const amountToClaim = await rewardsManager.pendingRewardTokens(poolIndex, deployer.address);
                await rewardsManager.withdraw(poolIndex, yakBalance);

                const poolInfo = await rewardsManager.poolInfo(poolIndex);
                userInfo = await rewardsManager.userInfo(poolIndex, deployer.address);
                expect(poolInfo.totalStaked).to.eq(0);
                expect(userInfo.amount).to.eq(0);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await wavaxToken.balanceOf(deployer.address)).to.be.closeTo(wavaxBalance.add(amountToClaim), amountToClaim.div(100));
            });

            it('allows a user to withdraw after reward period is over', async () => {
                const ALLOC_POINTS = "10";
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, true, true);
                const numPools = await rewardsManager.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);
                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);

                await yakToken.approve(rewardsManager.address, yakBalance);
                await rewardsManager.deposit(poolIndex, yakBalance);

                const endTimestamp = await rewardsManager.endTimestamp();
                expect(await rewardsManager.rewardsActive()).to.eq(true);
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(endTimestamp) + 1]);
                await ethers.provider.send("evm_mine");
                expect(await rewardsManager.rewardsActive()).to.eq(false);

                let userInfo = await rewardsManager.userInfo(poolIndex, deployer.address);
                const amountToClaim = await rewardsManager.pendingRewardTokens(poolIndex, deployer.address);
                await rewardsManager.withdraw(poolIndex, yakBalance);

                const poolInfo = await rewardsManager.poolInfo(poolIndex);
                userInfo = await rewardsManager.userInfo(poolIndex, deployer.address);
                expect(poolInfo.totalStaked).to.eq(0);
                expect(userInfo.amount).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await wavaxToken.balanceOf(deployer.address)).to.be.closeTo(wavaxBalance.add(amountToClaim), amountToClaim.div(100));
                expect(await wavaxToken.balanceOf(rewardsManager.address)).to.be.closeTo(ethers.utils.parseUnits("0"), amountToClaim.div(100));
            });
        });

        context('emergencyWithdraw', async () => {
            beforeEach(async () => {
                await rewardsManager.addRewardsBalance(INITIAL_WAVAX_REWARDS_BALANCE)
            });

            it('allows a user to emergencyWithdraw from a pool w/o voting power', async () => {
                const ALLOC_POINTS = "10"
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, true, false);
                const numPools = await rewardsManager.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);

                await yakToken.approve(rewardsManager.address, yakBalance);
                await rewardsManager.deposit(poolIndex, yakBalance);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);

                const DURATION = 600;
                expect(await rewardsManager.rewardsActive()).to.eq(true);
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");
                await rewardsManager.emergencyWithdraw(poolIndex);

                const poolInfo = await rewardsManager.poolInfo(poolIndex);
                const userInfo = await rewardsManager.userInfo(poolIndex, deployer.address);
                expect(poolInfo.totalStaked).to.eq(0);
                expect(userInfo.amount).to.eq(0);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await wavaxToken.balanceOf(rewardsManager.address)).to.eq(INITIAL_WAVAX_REWARDS_BALANCE);
            });

            it('allows a user to emergencyWithdraw from a pool w/ voting power', async () => {
                const ALLOC_POINTS = "10"
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, true, true);
                const numPools = await rewardsManager.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);
                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);

                await yakToken.approve(rewardsManager.address, yakBalance);
                await rewardsManager.deposit(poolIndex, yakBalance);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));
                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);

                const DURATION = 600;
                expect(await rewardsManager.rewardsActive()).to.eq(true);
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");
                await rewardsManager.emergencyWithdraw(poolIndex);

                const poolInfo = await rewardsManager.poolInfo(poolIndex);
                const userInfo = await rewardsManager.userInfo(poolIndex, deployer.address);
                expect(poolInfo.totalStaked).to.eq(0);
                expect(userInfo.amount).to.eq(0);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await wavaxToken.balanceOf(deployer.address)).to.eq(wavaxBalance);
                expect(await wavaxToken.balanceOf(rewardsManager.address)).to.eq(INITIAL_WAVAX_REWARDS_BALANCE);
            });

            xit('allows a user to emergencyWithdraw all rewards if reward period is over', async () => {
                const ALLOC_POINTS = "10"
                await rewardsManager.add(ALLOC_POINTS, yakToken.address, true, true)
                // todo
                expect(1).to.eq(2);
            });
        });
    });
  });