const { expect } = require("chai")
const { ethers } = require("hardhat");
const { liquidityFixture } = require("../fixtures")

describe('Liquidity', () => {
    let yakToken
    let wavaxToken
    let masterYak
    let votingPower
    let tokenRegistry
    let router
    let factory
    let farm
    let lockManager
    let deployer
    let alice
    let bob
    let ZERO_ADDRESS

    beforeEach(async () => {
        const fix = await liquidityFixture()
        yakToken = fix.yakToken
        wavaxToken = fix.wavaxToken
        votingPower = fix.votingPower
        tokenRegistry = fix.tokenRegistry
        masterYak = fix.masterYak
        router = fix.router
        factory = fix.factory
        farm = fix.farm
        pair = fix.pair
        lockManager = fix.lockManager
        deployer = fix.deployer
        alice = fix.alice
        bob = fix.bob
        ZERO_ADDRESS = fix.ZERO_ADDRESS
    })

    context('Pair setup', async () => {
        it('is a valid pair', async () => {
            expect(pair.address).to.not.eq(ZERO_ADDRESS);
        });

        it('has liquidity', async () => {
            expect(await yakToken.balanceOf(pair.address)).to.be.gt(0);
            expect(await wavaxToken.balanceOf(pair.address)).to.be.gt(0);
        });

        it('gave tokens to deployer', async () => {
            expect(await pair.balanceOf(deployer.address)).to.be.gt(0);
        });
    });

    context('MasterYak setup, with voting power', async () => {
        beforeEach(async() => {
            const ALLOC_POINTS = "20";
            await masterYak.add(ALLOC_POINTS, pair.address, true, true);
        })

        it('does not allow deposits before VP set', async () => {
            const pairBalance = await pair.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await expect(masterYak.deposit("1", pairBalance)).to.revertedWith("revert LM::calculateVotingPower: token not supported");
            expect(await pair.balanceOf(deployer.address)).to.eq(pairBalance);
            expect(await pair.balanceOf(masterYak.address)).to.eq(0);
        });

        it('allows deposits after VP set', async () => {
            const YakFormulaFactory = await ethers.getContractFactory("UpgradableFormula");
            const YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);

            const pairBalance = await pair.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await masterYak.deposit("1", pairBalance);
            expect(await pair.balanceOf(deployer.address)).to.eq(0);
            expect(await pair.balanceOf(masterYak.address)).to.eq(pairBalance);
        });

        it('allows withdraw and deposit after VP upgraded', async () => {
            const YakFormulaFactory = await ethers.getContractFactory("UpgradableFormula");
            let YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);

            let votes = await votingPower.balanceOf(deployer.address);
            const pairBalance = await pair.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await masterYak.deposit("1", pairBalance);

            YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);

            await masterYak.withdraw("1", pairBalance);
            expect(await pair.balanceOf(deployer.address)).to.eq(pairBalance);
            expect(await pair.balanceOf(masterYak.address)).to.eq(0);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);

            await pair.approve(masterYak.address, pairBalance);
            await masterYak.deposit("1", pairBalance);
            expect(await pair.balanceOf(deployer.address)).to.eq(0);
            expect(await pair.balanceOf(masterYak.address)).to.eq(pairBalance);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes.add(pairBalance.mul("10000000").div("1000000")));
        });

        it('allows withdraw after VP removed', async () => {
            const YakFormulaFactory = await ethers.getContractFactory("UpgradableFormula");
            let YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);

            let votes = await votingPower.balanceOf(deployer.address);
            const pairBalance = await pair.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await masterYak.deposit("1", pairBalance);

            await tokenRegistry.removeToken(pair.address);
            await masterYak.withdraw("1", pairBalance);
            expect(await pair.balanceOf(deployer.address)).to.eq(pairBalance);
            expect(await pair.balanceOf(masterYak.address)).to.eq(0);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);
        });

        it('allows emergencyWithdraw after VP removed', async () => {
            const YakFormulaFactory = await ethers.getContractFactory("UpgradableFormula");
            let YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);

            let votes = await votingPower.balanceOf(deployer.address);
            const pairBalance = await pair.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await masterYak.deposit("1", pairBalance);

            await tokenRegistry.removeToken(pair.address);
            await masterYak.emergencyWithdraw("1");
            expect(await pair.balanceOf(deployer.address)).to.eq(pairBalance);
            expect(await pair.balanceOf(masterYak.address)).to.eq(0);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);
        });

        it('does not allow deposit after VP removed', async () => {
            const YakFormulaFactory = await ethers.getContractFactory("UpgradableFormula");
            let YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);
            await tokenRegistry.removeToken(pair.address);

            let votes = await votingPower.balanceOf(deployer.address);
            const pairBalance = await pair.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await expect(masterYak.deposit("1", pairBalance)).to.revertedWith("revert LM::calculateVotingPower: token not supported");
            expect(await pair.balanceOf(deployer.address)).to.eq(pairBalance);
            expect(await pair.balanceOf(masterYak.address)).to.eq(0);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);
        });

        it('does not allow withdraw after LM removed', async () => {
            const YakFormulaFactory = await ethers.getContractFactory("UpgradableFormula");
            let YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);

            const pairBalance = await pair.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await masterYak.deposit("1", pairBalance);

            await masterYak.setLockManager(ZERO_ADDRESS);

            let votes = await votingPower.balanceOf(deployer.address);
            await expect(masterYak.withdraw("1", pairBalance)).to.revertedWith("Transaction reverted: function call to a non-contract account");
            expect(await pair.balanceOf(deployer.address)).to.eq(0);
            expect(await pair.balanceOf(masterYak.address)).to.eq(pairBalance);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);
        });

        it('does not allow emergencyWithdraw after LM removed', async () => {
            const YakFormulaFactory = await ethers.getContractFactory("UpgradableFormula");
            let YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);

            const pairBalance = await pair.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await masterYak.deposit("1", pairBalance);

            await masterYak.setLockManager(ZERO_ADDRESS);

            let votes = await votingPower.balanceOf(deployer.address);
            await expect(masterYak.emergencyWithdraw("1")).to.revertedWith("Transaction reverted: function call to a non-contract account");
            expect(await pair.balanceOf(deployer.address)).to.eq(0);
            expect(await pair.balanceOf(masterYak.address)).to.eq(pairBalance);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);
        });

        it('does not allow deposit after LM removed', async () => {
            const YakFormulaFactory = await ethers.getContractFactory("UpgradableFormula");
            let YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);
            await masterYak.setLockManager(ZERO_ADDRESS);

            let votes = await votingPower.balanceOf(deployer.address);
            const pairBalance = await pair.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await expect(masterYak.deposit("1", pairBalance)).to.revertedWith("Transaction reverted: function call to a non-contract account");
            expect(await pair.balanceOf(deployer.address)).to.eq(pairBalance);
            expect(await pair.balanceOf(masterYak.address)).to.eq(0);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);
        });
    });

    context("MasterYak LP farm", async () => {

        beforeEach(async() => {
            const YakFormulaFactory = await ethers.getContractFactory("UpgradableFormula");
            const YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);
            await masterYak.add("20", pair.address, true, true);
        });

        it("allows LP deposit", async () => {
            let pairBalance = await pair.balanceOf(deployer.address);
            let votes = await votingPower.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await masterYak.deposit("1", pairBalance);
            expect(await pair.balanceOf(deployer.address)).to.eq(0);
            expect(await pair.balanceOf(masterYak.address)).to.eq(pairBalance);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes.add(pairBalance.mul("10000").div("1000000")));
        });

        it("allows LP withdraw", async () => {
            let pairBalance = await pair.balanceOf(deployer.address);
            let votes = await votingPower.balanceOf(deployer.address);
            await pair.approve(masterYak.address, pairBalance);
            await masterYak.deposit("1", pairBalance);

            const { timestamp } = await ethers.provider.getBlock('latest');
            const DURATION = 600;
            await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(timestamp) + DURATION]);
            await ethers.provider.send("evm_mine");

            await masterYak.withdraw("1", pairBalance);
            expect(await pair.balanceOf(deployer.address)).to.eq(pairBalance);
            expect(await pair.balanceOf(masterYak.address)).to.eq(0);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);
        });

        it("allows reinvests", async () => {
            let pairBalance = await pair.balanceOf(deployer.address);
            let votes = await votingPower.balanceOf(deployer.address);
            await pair.approve(farm.address, pairBalance);
            await farm.deposit(pairBalance);

            const { timestamp } = await ethers.provider.getBlock('latest');
            const DURATION = 600;
            await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(timestamp) + DURATION]);
            await ethers.provider.send("evm_mine");
            expect(await farm.checkReward()).to.be.gt(0);

            let balance = await pair.balanceOf(masterYak.address);
            await farm.reinvest();
            expect(await pair.balanceOf(masterYak.address)).to.be.gt(balance);
            expect(await pair.balanceOf(deployer.address)).to.eq(0);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);
        });
    });

    context("MasterYak YRT farm", async () => {

        beforeEach(async() => {
            const YakFormulaFactory = await ethers.getContractFactory("UpgradableFormula");
            const YakFormula = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(pair.address, YakFormula.address);
            await masterYak.add("20", pair.address, true, true);

            const YakFormula2 = await YakFormulaFactory.deploy(deployer.address, "10000");
            await tokenRegistry.setTokenFormula(farm.address, YakFormula2.address);
            await masterYak.add("0", farm.address, true, true);
        });

        it("allows YRT deposit", async () => {
            let pairBalance = await pair.balanceOf(deployer.address);
            let votes = await votingPower.balanceOf(deployer.address);
            await pair.approve(farm.address, pairBalance);
            await farm.deposit(pairBalance);
            expect(await pair.balanceOf(deployer.address)).to.eq(0);
            expect(await farm.balanceOf(deployer.address)).to.eq(pairBalance);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);

            await farm.approve(masterYak.address, pairBalance);
            await masterYak.deposit("2", pairBalance);
            expect(await farm.balanceOf(deployer.address)).to.eq(0);
            expect(await farm.balanceOf(masterYak.address)).to.eq(pairBalance);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes.add(pairBalance.mul("10000").div("1000000")));
        });

        it("allows YRT withdraw", async () => {
            let pairBalance = await pair.balanceOf(deployer.address);
            let votes = await votingPower.balanceOf(deployer.address);
            await pair.approve(farm.address, pairBalance);
            await farm.deposit(pairBalance);
            await farm.approve(masterYak.address, pairBalance);
            await masterYak.deposit("2", pairBalance);

            const { timestamp } = await ethers.provider.getBlock('latest');
            const DURATION = 600;
            await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(timestamp) + DURATION]);
            await ethers.provider.send("evm_mine");

            await masterYak.withdraw("2", pairBalance);
            expect(await farm.balanceOf(deployer.address)).to.eq(pairBalance);
            expect(await farm.balanceOf(masterYak.address)).to.eq(0);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);
        });

        it("allows reinvests on underlying", async () => {
            let pairBalance = await pair.balanceOf(deployer.address);
            await pair.approve(farm.address, pairBalance);
            await farm.deposit(pairBalance);

            let farmBalance = await farm.balanceOf(deployer.address);
            await farm.approve(masterYak.address, farmBalance);
            await masterYak.deposit("2", farmBalance);
            let votes = await votingPower.balanceOf(deployer.address);

            const { timestamp } = await ethers.provider.getBlock('latest');
            const DURATION = 600;
            await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(timestamp) + DURATION]);
            await ethers.provider.send("evm_mine");
            expect(await farm.checkReward()).to.be.gt(0);

            let balance = await pair.balanceOf(masterYak.address);
            await farm.reinvest();
            expect(await farm.balanceOf(deployer.address)).to.eq(0);
            expect(await pair.balanceOf(masterYak.address)).to.be.gt(balance);
            expect(await pair.balanceOf(deployer.address)).to.eq(0);
            expect(await votingPower.balanceOf(deployer.address)).to.eq(votes);
        });
    });

  });