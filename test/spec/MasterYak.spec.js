const { expect } = require("chai")
const { ethers } = require("hardhat");
const { rewardsFixture } = require("../fixtures")

const INITIAL_AVAX_REWARDS_BALANCE = process.env.INITIAL_AVAX_REWARDS_BALANCE
const AVAX_REWARDS_PER_SECOND = process.env.AVAX_REWARDS_PER_SECOND
const FACTOR = ethers.BigNumber.from("10").pow("12")

async function getBalance(address) {
    return await ethers.provider.getBalance(address);
}

describe('MasterYak', () => {
    let yakToken
    let wavaxToken
    let masterYak
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
        masterYak = fix.masterYak
        lockManager = fix.lockManager
        deployer = fix.deployer
        alice = fix.alice
        bob = fix.bob
        startTimestamp = await masterYak.startTimestamp()
        rewardsPerSecond = await masterYak.rewardsPerSecond()
    })

    context('before startTimestamp', async () => {
        context('rewardsActive', async () => {
            it('returns false if rewards have not started', async () => {
                const { timestamp } = await ethers.provider.getBlock('latest');
                expect(timestamp).to.gte(startTimestamp);
                expect(await masterYak.rewardsActive()).to.eq(false)
            });

            it('returns true if rewards have started', async () => {
                const { timestamp } = await ethers.provider.getBlock('latest');
                const ALLOC_POINTS = "10"
                await masterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE })
                await masterYak.add(ALLOC_POINTS, yakToken.address, true, true)
                expect(timestamp).to.gte(startTimestamp);
                expect(await masterYak.rewardsActive()).to.eq(true)
            });
        });
    });

    context('admin actions', async () => {
        it('updates end timestamp when rewards are added', async () => {
            let endTimestamp = await masterYak.endTimestamp();
            expect(endTimestamp).to.eq(0);
            expect(rewardsPerSecond).to.eq(AVAX_REWARDS_PER_SECOND);

            let addRewardsBalanceTx = await masterYak.addRewardsBalance({ value: ethers.BigNumber.from(INITIAL_AVAX_REWARDS_BALANCE).div("2")});
            let addRewardsBalanceTxReceipt = await addRewardsBalanceTx.wait(0);
            let addRewardsBalanceTxBlock = await ethers.provider.getBlock(addRewardsBalanceTxReceipt.blockNumber);
            endTimestamp = await masterYak.endTimestamp();
            expect(endTimestamp).to.eq(ethers.BigNumber.from(addRewardsBalanceTxBlock.timestamp).add(ethers.BigNumber.from(INITIAL_AVAX_REWARDS_BALANCE).div("2").div(rewardsPerSecond)));

            addRewardsBalanceTx = await masterYak.addRewardsBalance({ value: ethers.BigNumber.from(INITIAL_AVAX_REWARDS_BALANCE).div("2") });
            addRewardsBalanceTxReceipt = await addRewardsBalanceTx.wait(0);
            addRewardsBalanceTxBlock = await ethers.provider.getBlock(addRewardsBalanceTxReceipt.blockNumber);
            endTimestamp = await masterYak.endTimestamp();
            expect(endTimestamp).to.eq(ethers.BigNumber.from(addRewardsBalanceTxBlock.timestamp).add(ethers.BigNumber.from(INITIAL_AVAX_REWARDS_BALANCE).div("2").mul(2).div(rewardsPerSecond)));
        });
    });

    context('startTimestamp', async () => {
        context('rewardsActive', async () => {
            it('returns true if rewards period is active', async () => {
                expect(await masterYak.rewardsActive()).to.eq(false)
                await masterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE })
                const ALLOC_POINTS = "10"
                await masterYak.add(ALLOC_POINTS, yakToken.address, false, true)
                expect(await masterYak.rewardsActive()).to.eq(true)
            });
        });
    
        context('add', async () => {
            beforeEach(async () => {
                await masterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE })
            });
            
            it('successfully adds a valid YAK pool w/ voting power', async () => {
                const ALLOC_POINTS = "10"
                const numPools = await masterYak.poolLength()
                const numTotalAllocPoints = await masterYak.totalAllocPoint()
                await masterYak.add(ALLOC_POINTS, yakToken.address, false, true)
                expect(await masterYak.poolLength()).to.eq(numPools.add(1))
                expect(await masterYak.totalAllocPoint()).to.eq(numTotalAllocPoints.add(ALLOC_POINTS))

                const contractBal = await wavaxToken.balanceOf(masterYak.address)
                const rewardsPerSecond = await masterYak.rewardsPerSecond()
                const newPool = await masterYak.poolInfo(numPools)

                expect(newPool.token).to.eq(yakToken.address)
                expect(newPool.allocPoint).to.eq(ALLOC_POINTS)
                // expect(await masterYak.endTimestamp()).to.eq(startTimestamp.add(contractBal.div(rewardsPerSecond)))

                const yakBalance = await yakToken.balanceOf(deployer.address)
                await yakToken.approve(masterYak.address, yakBalance)
                await masterYak.deposit(numPools, yakBalance)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000))
            });
            
            it('reverts for a pool w/ voting power w/o a formula', async () => {
                const ALLOC_POINTS = "10"
                const WAVAX_TO_DEPOSIT = ethers.utils.parseUnits("1");
                const numPools = await masterYak.poolLength()
                await masterYak.add(ALLOC_POINTS, wavaxToken.address, false, true)

                await wavaxToken.deposit({ value: WAVAX_TO_DEPOSIT });
                await wavaxToken.approve(masterYak.address, WAVAX_TO_DEPOSIT)
                await expect(masterYak.deposit(numPools, WAVAX_TO_DEPOSIT)).to.revertedWith("LM::calculateVotingPower: token not supported")
            });
            
            it('successfully adds a valid YAK pool w/o voting power', async () => {
                const ALLOC_POINTS = "10"
                const numPools = await masterYak.poolLength()
                const numTotalAllocPoints = await masterYak.totalAllocPoint()
                await masterYak.add(ALLOC_POINTS, yakToken.address, false, false)
                expect(await masterYak.poolLength()).to.eq(numPools.add(1))
                expect(await masterYak.totalAllocPoint()).to.eq(numTotalAllocPoints.add(ALLOC_POINTS))

                const contractBal = await wavaxToken.balanceOf(masterYak.address)
                const rewardsPerSecond = await masterYak.rewardsPerSecond()
                const newPool = await masterYak.poolInfo(numPools)

                expect(newPool.token).to.eq(yakToken.address)
                expect(newPool.allocPoint).to.eq(ALLOC_POINTS)
                // expect(await masterYak.endTimestamp()).to.eq(startTimestamp.add(contractBal.div(rewardsPerSecond)))

                const yakBalance = await yakToken.balanceOf(deployer.address)
                await yakToken.approve(masterYak.address, yakBalance)
                await masterYak.deposit(numPools, yakBalance)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0)
            });
            
            it('successfully adds a valid pool w/ voting power w/o rewards', async () => {
                const ALLOC_POINTS = "0"
                const numPools = await masterYak.poolLength()
                const numTotalAllocPoints = await masterYak.totalAllocPoint()
                await masterYak.add(ALLOC_POINTS, yakToken.address, false, true)
                expect(await masterYak.poolLength()).to.eq(numPools.add(1))
                expect(await masterYak.totalAllocPoint()).to.eq(numTotalAllocPoints.add(ALLOC_POINTS))

                const contractBal = await wavaxToken.balanceOf(masterYak.address)
                const rewardsPerSecond = await masterYak.rewardsPerSecond()
                const newPool = await masterYak.poolInfo(numPools)

                expect(newPool.token).to.eq(yakToken.address)
                expect(newPool.allocPoint).to.eq(ALLOC_POINTS)
                // expect(await masterYak.endTimestamp()).to.eq(startTimestamp.add(contractBal.div(rewardsPerSecond)))

                const yakBalance = await yakToken.balanceOf(deployer.address)
                await yakToken.approve(masterYak.address, yakBalance)
                await masterYak.deposit(numPools, yakBalance)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000))
            });

            it('successfully adds a second and third pool', async () => {
                await masterYak.add("10", yakToken.address, false, true);
                await masterYak.add("20", yakToken.address, false, true);
                await masterYak.add("0", yakToken.address, false, true);
                expect(await masterYak.poolLength()).to.eq(3)
                expect(await masterYak.totalAllocPoint()).to.eq(30)
            });

            it('does not allow non-owner to add pool', async () => {
                const ALLOC_POINTS = "10"
                await expect(masterYak.connect(alice).add(ALLOC_POINTS, yakToken.address, false, true)).to.revertedWith("not owner")
            });
        });

        context('set', async () => {
            beforeEach(async () => {
                const ALLOC_POINTS = "10"
                await masterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE })
                await masterYak.add(ALLOC_POINTS, yakToken.address, false, true)
            });

            it('allows owner to set alloc points for pool', async () => {
                const ALLOC_POINTS = "20"
                const numPools = await masterYak.poolLength()
                const pid = numPools.sub(1)
                await masterYak.set(pid, ALLOC_POINTS, true)
                const pool = await masterYak.poolInfo(pid)
                expect(pool.allocPoint).to.eq(ALLOC_POINTS)
            });

            it('does not allow non-owner to set alloc points for pool', async () => {
                const ALLOC_POINTS = "20"
                const numPools = await masterYak.poolLength()
                const pid = numPools.sub(1)
                await expect(masterYak.connect(alice).set(pid, ALLOC_POINTS, true)).to.revertedWith("not owner")
            });
        });

        context('deposit', async () => {
            beforeEach(async () => {
                const ALLOC_POINTS = "10"
                await masterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE })
                await masterYak.add(ALLOC_POINTS, yakToken.address, false, true)
            });

            it('allows a user to deposit', async () => {
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);

                const avaxBalanceBefore = await getBalance(deployer.address);
                let gasSpent = ethers.BigNumber.from("0");
                let tx, txReceipt
                tx = await yakToken.approve(masterYak.address, yakBalance);
                txReceipt = await tx.wait(0);
                gasSpent = gasSpent.add(txReceipt.gasUsed.mul(tx.gasPrice));

                tx = await masterYak.deposit(poolIndex, yakBalance);
                txReceipt = await tx.wait(0);
                gasSpent = gasSpent.add(txReceipt.gasUsed.mul(tx.gasPrice));

                let userInfo = await masterYak.userInfo(poolIndex, deployer.address);
                let poolInfo = await masterYak.poolInfo(poolIndex);

                expect(userInfo.amount).to.eq(yakBalance);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(poolInfo.totalStaked).to.eq(yakBalance);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));
                expect(await getBalance(deployer.address)).to.eq(avaxBalanceBefore.sub(gasSpent));
            })

            it('allows a user to harvest rewards by passing in zero as amount', async () => {
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);

                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);
                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.deposit(poolIndex, yakBalance);
                
                const DURATION = 600;
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");

                const amountToClaim = await masterYak.pendingRewards(poolIndex, deployer.address);
                const avaxBalance = await getBalance(deployer.address);

                const tx = await masterYak.deposit(poolIndex, 0);
                const txReceipt = await tx.wait(0);
                const gasSpent = txReceipt.gasUsed.mul(tx.gasPrice);

                const poolInfo = await masterYak.poolInfo(poolIndex);
                let userInfo = await masterYak.userInfo(poolIndex, deployer.address);

                expect(poolInfo.totalStaked).to.eq(yakBalance);
                expect(userInfo.amount).to.eq(yakBalance);
                expect(userInfo.rewardTokenDebt).to.be.closeTo(amountToClaim, amountToClaim.div(100));
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));
                expect(await wavaxToken.balanceOf(deployer.address)).to.eq(wavaxBalance);
                expect(await getBalance(deployer.address)).to.be.closeTo(avaxBalance.add(amountToClaim).sub(gasSpent), amountToClaim.div(100));
            });
        })

        context('withdraw', async () => {
            beforeEach(async () => {
                await masterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE })
            });

            it('allows a user to withdraw from a pool w/o voting power', async () => {
                const ALLOC_POINTS = "10"
                await masterYak.add(ALLOC_POINTS, yakToken.address, false, false);
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);
                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);

                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.deposit(poolIndex, yakBalance);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);

                const DURATION = 600;
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");

                const amountToClaim = await masterYak.pendingRewards(poolIndex, deployer.address);
                const avaxBalance = await getBalance(deployer.address);
                const tx = await masterYak.withdraw(poolIndex, yakBalance);
                const txReceipt = await tx.wait(0);
                const gasSpent = txReceipt.gasUsed.mul(tx.gasPrice);

                const poolInfo = await masterYak.poolInfo(poolIndex);
                const userInfo = await masterYak.userInfo(poolIndex, deployer.address);
                expect(poolInfo.totalStaked).to.eq(0);
                expect(userInfo.amount).to.eq(0);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await getBalance(deployer.address)).to.be.closeTo(avaxBalance.add(amountToClaim).sub(gasSpent), amountToClaim.div(100));
                expect(await wavaxToken.balanceOf(deployer.address)).to.eq(wavaxBalance);
            });

            it('allows a user to withdraw from a pool w/ voting power', async () => {
                const ALLOC_POINTS = "10";
                await masterYak.add(ALLOC_POINTS, yakToken.address, true, true);
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);
                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);

                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.deposit(poolIndex, yakBalance);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));

                const DURATION = 600;
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");

                const amountToClaim = await masterYak.pendingRewards(poolIndex, deployer.address);
                const avaxBalance = await getBalance(deployer.address);
                const tx = await masterYak.withdraw(poolIndex, yakBalance);
                const txReceipt = await tx.wait(0);
                const gasSpent = txReceipt.gasUsed.mul(tx.gasPrice);

                const poolInfo = await masterYak.poolInfo(poolIndex);
                const userInfo = await masterYak.userInfo(poolIndex, deployer.address);
                expect(poolInfo.totalStaked).to.eq(0);
                expect(userInfo.amount).to.eq(0);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await getBalance(deployer.address)).to.be.closeTo(avaxBalance.add(amountToClaim).sub(gasSpent), amountToClaim.div(100));
                expect(await wavaxToken.balanceOf(deployer.address)).to.eq(wavaxBalance);
            });

            it('does not allow a user to withdraw 0', async () => {
                const ALLOC_POINTS = "10";
                await masterYak.add(ALLOC_POINTS, yakToken.address, true, true);
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);

                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.deposit(poolIndex, yakBalance);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));

                const DURATION = 600;
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");

                await expect(masterYak.withdraw(poolIndex, 0)).to.revertedWith("revert MasterYak::withdraw: amount must be > 0");

                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));
            });

            it('allows a user to withdraw after reward period is over', async () => {
                const ALLOC_POINTS = "10";
                await masterYak.add(ALLOC_POINTS, yakToken.address, true, true);
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);
                const avaxBalance = await getBalance(deployer.address);
                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);

                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.deposit(poolIndex, yakBalance);

                const endTimestamp = await masterYak.endTimestamp();
                expect(await masterYak.rewardsActive()).to.eq(true);
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(endTimestamp) + 1]);
                await ethers.provider.send("evm_mine");
                expect(await masterYak.rewardsActive()).to.eq(false);

                let userInfo = await masterYak.userInfo(poolIndex, deployer.address);
                const amountToClaim = await masterYak.pendingRewards(poolIndex, deployer.address);
                await masterYak.withdraw(poolIndex, yakBalance);

                const poolInfo = await masterYak.poolInfo(poolIndex);
                userInfo = await masterYak.userInfo(poolIndex, deployer.address);
                expect(poolInfo.totalStaked).to.eq(0);
                expect(userInfo.amount).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await getBalance(deployer.address)).to.be.closeTo(avaxBalance.add(amountToClaim), amountToClaim.div(100));
                expect(await wavaxToken.balanceOf(deployer.address)).to.eq(wavaxBalance);
                expect(await wavaxToken.balanceOf(masterYak.address)).to.be.closeTo(ethers.utils.parseUnits("0"), amountToClaim.div(100));
            });
        });

        context('setRewardsPerSecond', async () => {
            beforeEach(async () => {
                const ALLOC_POINTS = "10"
                await masterYak.add(ALLOC_POINTS, yakToken.address, false, true);
            });

            it('allows a user to deposit before rewards are added', async () => {
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);

                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.deposit(poolIndex, yakBalance);
                const { timestamp } = await ethers.provider.getBlock('latest');
                
                let userInfo = await masterYak.userInfo(poolIndex, deployer.address)
                let poolInfo = await masterYak.poolInfo(poolIndex);

                expect(userInfo.amount).to.eq(yakBalance);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(poolInfo.token).to.eq(yakToken.address);
                expect(poolInfo.allocPoint).to.eq(10);
                expect(poolInfo.lastRewardTimestamp).to.eq(timestamp);
                expect(poolInfo.accRewardsPerShare).to.eq(0);
                expect(poolInfo.totalStaked).to.eq(yakBalance);
                expect(poolInfo.vpForDeposit).to.eq(true);

                const DURATION = 600;
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(poolInfo.lastRewardTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");

                poolInfo = await masterYak.poolInfo(poolIndex);
                expect(poolInfo.lastRewardTimestamp).to.eq(timestamp);
                expect(poolInfo.accRewardsPerShare).to.eq(0);
                expect(await masterYak.pendingRewards("0", deployer.address)).to.eq(0);
            })

            it('accumulates expected rewards after rewards are added', async () => {
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);
                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);
                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.deposit(poolIndex, yakBalance);
                const { timestamp } = await ethers.provider.getBlock('latest');
                
                let poolInfo = await masterYak.poolInfo(poolIndex);

                const DURATION = 600;
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(poolInfo.lastRewardTimestamp) + DURATION]);
                await masterYak.updatePool(poolIndex);
                await masterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE })

                poolInfo = await masterYak.poolInfo(poolIndex);
                expect(poolInfo.lastRewardTimestamp).to.eq(timestamp + DURATION);

                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(poolInfo.lastRewardTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");

                expect(poolInfo.accRewardsPerShare).to.eq(0);
                const expectedRewardsAmount = rewardsPerSecond.mul(DURATION);
                expect(await masterYak.pendingRewards("0", deployer.address)).to.be.closeTo(expectedRewardsAmount, expectedRewardsAmount.div("100"));
            })

            it('accumulates expected rewards after rewards per second are changed', async () => {
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);

                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE })
                await masterYak.deposit(poolIndex, yakBalance);
                const { timestamp } = await ethers.provider.getBlock('latest');
                
                let poolInfo = await masterYak.poolInfo(poolIndex);
                let newRewardsPerSecond = rewardsPerSecond.div("10");

                const DURATION = 600;
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(poolInfo.lastRewardTimestamp) + DURATION]);
                await masterYak.updatePool(poolIndex);

                let expectedRewardsAmount = rewardsPerSecond.mul(DURATION);
                expect(await masterYak.pendingRewards("0", deployer.address)).to.be.closeTo(expectedRewardsAmount, expectedRewardsAmount.div("100"));

                await masterYak.setRewardsPerSecond(newRewardsPerSecond);
                expect(await masterYak.rewardsPerSecond()).to.eq(newRewardsPerSecond);

                poolInfo = await masterYak.poolInfo(poolIndex);
                expect(poolInfo.lastRewardTimestamp).to.eq(timestamp + DURATION);

                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(poolInfo.lastRewardTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");

                expectedRewardsAmount = expectedRewardsAmount.add(newRewardsPerSecond.mul(DURATION));
                expect(await masterYak.pendingRewards("0", deployer.address)).to.be.closeTo(expectedRewardsAmount, expectedRewardsAmount.div("100"));
            })
        });

        context('emergencyWithdraw', async () => {
            beforeEach(async () => {
                await masterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE })
            });

            it('allows a user to emergencyWithdraw from a pool w/o voting power', async () => {
                const ALLOC_POINTS = "10"
                await masterYak.add(ALLOC_POINTS, yakToken.address, true, false);
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);

                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.deposit(poolIndex, yakBalance);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);

                const DURATION = 600;
                expect(await masterYak.rewardsActive()).to.eq(true);
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");
                await masterYak.emergencyWithdraw(poolIndex);

                const poolInfo = await masterYak.poolInfo(poolIndex);
                const userInfo = await masterYak.userInfo(poolIndex, deployer.address);
                expect(poolInfo.totalStaked).to.eq(0);
                expect(userInfo.amount).to.eq(0);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await ethers.provider.getBalance(masterYak.address)).to.eq(INITIAL_AVAX_REWARDS_BALANCE);
            });

            it('allows a user to emergencyWithdraw from a pool w/ voting power', async () => {
                const ALLOC_POINTS = "10"
                await masterYak.add(ALLOC_POINTS, yakToken.address, true, true);
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);
                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);

                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.deposit(poolIndex, yakBalance);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));
                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);

                const DURATION = 600;
                expect(await masterYak.rewardsActive()).to.eq(true);
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
                await ethers.provider.send("evm_mine");
                await masterYak.emergencyWithdraw(poolIndex);

                const poolInfo = await masterYak.poolInfo(poolIndex);
                const userInfo = await masterYak.userInfo(poolIndex, deployer.address);
                expect(poolInfo.totalStaked).to.eq(0);
                expect(userInfo.amount).to.eq(0);
                expect(userInfo.rewardTokenDebt).to.eq(0);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await wavaxToken.balanceOf(deployer.address)).to.eq(wavaxBalance);
                expect(await ethers.provider.getBalance(masterYak.address)).to.eq(INITIAL_AVAX_REWARDS_BALANCE);
            });

            it('allows a user to emergencyWithdraw if reward period is over', async () => {
                const ALLOC_POINTS = "10";
                await masterYak.add(ALLOC_POINTS, yakToken.address, true, true);
                const numPools = await masterYak.poolLength();
                const poolIndex = numPools.sub(1);
                const yakBalance = await yakToken.balanceOf(deployer.address);
                const wavaxBalance = await wavaxToken.balanceOf(deployer.address);

                await yakToken.approve(masterYak.address, yakBalance);
                await masterYak.deposit(poolIndex, yakBalance);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(yakBalance);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(yakBalance.mul(1000));
                expect(await yakToken.balanceOf(deployer.address)).to.eq(0);

                const endTimestamp = await masterYak.endTimestamp();
                expect(await masterYak.rewardsActive()).to.eq(true);
                await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(endTimestamp) + 1]);
                await ethers.provider.send("evm_mine");
                expect(await masterYak.rewardsActive()).to.eq(false);

                await masterYak.emergencyWithdraw(poolIndex);
                expect(await lockManager.getAmountStaked(deployer.address, yakToken.address)).to.eq(0);
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
                expect(await yakToken.balanceOf(deployer.address)).to.eq(yakBalance);
                expect(await wavaxToken.balanceOf(deployer.address)).to.eq(wavaxBalance);
            });
        });
    });
  });