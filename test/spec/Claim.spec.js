const { expect } = require("chai");
const fs = require('fs')
const { ethers, network } = require("hardhat");
const { airdropFixture } = require("../fixtures")

describe("Claim", function() {
    let yakToken
    let claim
    let deployer
    let alice
    let bob
    let ZERO_ADDRESS

    beforeEach(async () => {
        const fix = await airdropFixture()
        yakToken = fix.yakToken
        claim = fix.claim
        deployer = fix.deployer
        alice = fix.alice
        bob = fix.bob
        ZERO_ADDRESS = fix.ZERO_ADDRESS
    })

  context("Post-Init", async () => {
    context("addGrant", async () => {
      it("creates valid grant", async function() {
        await yakToken.approve(claim.address, ethers.constants.MaxUint256);
        let grantAmount = ethers.utils.parseUnits("10");
        let contractBalance = await yakToken.balanceOf(claim.address);
        await claim.addTokenGrant(alice.address, grantAmount);
        const newGrant = await claim.getTokenGrant(alice.address);
        expect(contractBalance).to.eq(0);
        expect(newGrant).to.eq(grantAmount);
        contractBalance = contractBalance.add(grantAmount)
        expect(await yakToken.balanceOf(claim.address)).to.eq(contractBalance)
      })

      it("creates valid grant for 1 wei", async function() {
        await yakToken.approve(claim.address, ethers.constants.MaxUint256);
        let grantAmount = ethers.BigNumber.from(1);
        let contractBalance = await yakToken.balanceOf(claim.address);
        await claim.addTokenGrant(alice.address, grantAmount);
        const newGrant = await claim.getTokenGrant(alice.address);
        expect(contractBalance).to.eq(0);
        expect(newGrant).to.eq(grantAmount);
        contractBalance = contractBalance.add(grantAmount)
        expect(await yakToken.balanceOf(claim.address)).to.eq(contractBalance)
      })

      it("creates valid grants from file", async function() {
        await yakToken.approve(claim.address, ethers.constants.MaxUint256)
        const tokenGrants = JSON.parse(fs.readFileSync(`./grants/${network.name}.json`, 'utf-8'))
        let contractBalance = await yakToken.balanceOf(claim.address)

        for(const grant of tokenGrants) {
            if (grant.class !== "unlocked") continue;
            let grantAmount = ethers.utils.parseUnits(grant.amount);
            await claim.addTokenGrant(grant.recipient, grantAmount)
            expect(await claim.getTokenGrant(grant.recipient)).to.eq(grantAmount)
            contractBalance = contractBalance.add(grantAmount)
        }
        
        expect(await yakToken.balanceOf(claim.address)).to.eq(contractBalance)
      })

      it("does not allow non-owner to create a grant", async function() {
        await yakToken.connect(bob).approve(claim.address, ethers.constants.MaxUint256);
        let contractBalance = await yakToken.balanceOf(claim.address);
        let grantAmount = ethers.utils.parseUnits("10");
        await expect(claim.connect(bob).addTokenGrant(alice.address, grantAmount)).to.revertedWith("revert Claim::addTokenGrant: not owner");
        expect(await yakToken.balanceOf(claim.address)).to.eq(contractBalance);
        const emptyGrant = await claim.getTokenGrant(alice.address);
        expect(emptyGrant).to.eq(0);
      });

      it("does add grant for an account with an existing grant", async function() {
        await yakToken.approve(claim.address, ethers.constants.MaxUint256)
        let contractBalance = await yakToken.balanceOf(claim.address)
        let grantAmount = ethers.utils.parseUnits("10");

        await claim.addTokenGrant(alice.address, grantAmount)
        expect(await claim.getTokenGrant(alice.address)).to.eq(grantAmount)
        contractBalance = contractBalance.add(grantAmount)
        expect(await yakToken.balanceOf(claim.address)).to.eq(contractBalance)

        await claim.addTokenGrant(alice.address, grantAmount);
        expect(await claim.getTokenGrant(alice.address)).to.eq(grantAmount.mul(2));
        contractBalance = contractBalance.add(grantAmount)
        expect(await yakToken.balanceOf(claim.address)).to.eq(contractBalance)
      });

      it("does not allow a grant to be added with 0", async function() {
        await yakToken.approve(claim.address, ethers.constants.MaxUint256)
        let contractBalance = await yakToken.balanceOf(claim.address)
        let grantAmount = ethers.utils.parseUnits("0");
        await expect(claim.addTokenGrant(alice.address, grantAmount)).to.revertedWith("revert Claim::addTokenGrant: zero grant")
        expect(await yakToken.balanceOf(claim.address)).to.eq(contractBalance)
        expect(await claim.getTokenGrant(alice.address)).to.eq(0)
      });

      it("does not allow a grant when owner has insufficient balance", async function() {
        await yakToken.approve(claim.address, ethers.constants.MaxUint256)
        await yakToken.transfer(bob.address, await yakToken.balanceOf(deployer.address))
        let contractBalance = await yakToken.balanceOf(claim.address)
        let grantAmount = ethers.utils.parseUnits("10");
        await expect(claim.addTokenGrant(alice.address, grantAmount)).to.revertedWith("revert Yak::_transferTokens: transfer exceeds from balance")
        expect(await yakToken.balanceOf(claim.address)).to.eq(contractBalance)
        expect(await claim.getTokenGrant(alice.address)).to.eq(0)
      });
    });

    context("getTokenGrant", async () => {
      it("returns total granted if none claimed", async function() {
        await yakToken.approve(claim.address, ethers.constants.MaxUint256)
        let grantAmount = ethers.utils.parseUnits("10");
        let totalGranted = ethers.utils.parseUnits("0");
        
        await claim.addTokenGrant(alice.address, grantAmount);
        totalGranted = totalGranted.add(grantAmount);
        expect(await claim.getTokenGrant(alice.address)).to.eq(totalGranted);

        await claim.addTokenGrant(alice.address, grantAmount);
        totalGranted = totalGranted.add(grantAmount);
        expect(await claim.getTokenGrant(alice.address)).to.eq(totalGranted);
      });
    });

    context("claimTokens", async () => {
      it("does not allow user to claim with zero balance", async function() {
        await yakToken.approve(claim.address, ethers.constants.MaxUint256);
        let grantAmount = ethers.utils.parseUnits("10");

        await claim.addTokenGrant(alice.address, grantAmount);
        expect(await yakToken.balanceOf(alice.address)).to.equal(0);
        expect(await yakToken.balanceOf(claim.address)).to.equal(grantAmount);

        await claim.connect(alice).claim();
        expect(await yakToken.balanceOf(alice.address)).to.equal(grantAmount);
        expect(await yakToken.balanceOf(claim.address)).to.equal(0);

        await expect(claim.connect(alice).claim()).to.revertedWith("revert Claim::claim: availableToClaim is 0");
        expect(await yakToken.balanceOf(alice.address)).to.equal(grantAmount);
        expect(await yakToken.balanceOf(claim.address)).to.equal(0);
      });

      it("allows user to claim tokens multiple times", async function() {
        await yakToken.approve(claim.address, ethers.constants.MaxUint256);
        let grantAmount = ethers.utils.parseUnits("10");

        await claim.addTokenGrant(alice.address, grantAmount);
        expect(await yakToken.balanceOf(alice.address)).to.equal(0);
        expect(await yakToken.balanceOf(claim.address)).to.equal(grantAmount);

        await claim.connect(alice).claim();
        expect(await yakToken.balanceOf(alice.address)).to.equal(grantAmount);
        expect(await yakToken.balanceOf(claim.address)).to.equal(0);

        await claim.addTokenGrant(alice.address, grantAmount);
        expect(await yakToken.balanceOf(alice.address)).to.equal(grantAmount);
        expect(await yakToken.balanceOf(claim.address)).to.equal(grantAmount);

        await claim.connect(alice).claim();
        expect(await yakToken.balanceOf(alice.address)).to.equal(grantAmount.mul(2));
        expect(await yakToken.balanceOf(claim.address)).to.equal(0);
      });
    });

    context("changeOwner", async () => {

      it("allows owner to set new valid owner", async function() {
        await claim.changeOwner(alice.address)
        expect(await claim.owner()).to.eq(alice.address)
      })

      it("does not allow non-owner to change owner", async function() {
        await expect(claim.connect(alice).changeOwner(bob.address)).to.revertedWith("revert Claim::changeOwner: not owner")
        expect(await claim.owner()).to.eq(deployer.address)
      })

      it("does not allow owner to set invalid owner", async function() {
        await expect(claim.changeOwner(ZERO_ADDRESS)).to.revertedWith("revert Claim::changeOwner: not valid address")
        await expect(claim.changeOwner(claim.address)).to.revertedWith("revert Claim::changeOwner: not valid address")
        await expect(claim.changeOwner(yakToken.address)).to.revertedWith("revert Claim::changeOwner: not valid address")
        expect(await claim.owner()).to.eq(deployer.address)
      })
    })
  })
})
