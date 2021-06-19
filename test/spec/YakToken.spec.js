const { expect } = require("chai")
const { ethers } = require("hardhat");
const { tokenFixture } = require("../fixtures")
const { ecsign } = require("ethereumjs-util")

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY

const DOMAIN_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
)

const PERMIT_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

describe('YakToken', () => {
    let yakToken
    let deployer
    let alice
    let bob
    let ZERO_ADDRESS

    beforeEach(async () => {
      const fix = await tokenFixture()
      yakToken = fix.yakToken
      deployer = fix.deployer
      alice = fix.alice
      bob = fix.bob
      ZERO_ADDRESS = fix.ZERO_ADDRESS
    })

    context('transfer', async () => {
      it('allows a valid transfer', async () => {
        const amount = 100
        const balanceBefore = await yakToken.balanceOf(alice.address)
        await yakToken.transfer(alice.address, amount)
        expect(await yakToken.balanceOf(alice.address)).to.eq(balanceBefore.add(amount))
      })

      it('does not allow a transfer to the zero address', async () => {
        const amount = 100
        await expect(yakToken.transfer(ZERO_ADDRESS, amount)).to.revertedWith("Yak::_transferTokens: cannot transfer to the zero address")
      })
    })

    context('transferFrom', async () => {
      it('allows a valid transferFrom', async () => {
        const amount = 100
        const senderBalanceBefore = await yakToken.balanceOf(deployer.address)
        const receiverBalanceBefore = await yakToken.balanceOf(bob.address)
        await yakToken.approve(alice.address, amount)
        expect(await yakToken.allowance(deployer.address, alice.address)).to.eq(amount)
        await yakToken.connect(alice).transferFrom(deployer.address, bob.address, amount)
        expect(await yakToken.balanceOf(deployer.address)).to.eq(senderBalanceBefore.sub(amount))
        expect(await yakToken.balanceOf(bob.address)).to.eq(receiverBalanceBefore.add(amount))
        expect(await yakToken.allowance(deployer.address, alice.address)).to.eq(0)
      })

      it('allows for infinite approvals', async () => {
        const amount = 100
        const maxAmount = ethers.constants.MaxUint256
        await yakToken.approve(alice.address, maxAmount)
        expect(await yakToken.allowance(deployer.address, alice.address)).to.eq(maxAmount)
        await yakToken.connect(alice).transferFrom(deployer.address, bob.address, amount)
        expect(await yakToken.allowance(deployer.address, alice.address)).to.eq(maxAmount)
      })

      it('cannot transfer in excess of the spender allowance', async () => {
        await yakToken.transfer(alice.address, 100)
        const balance = await yakToken.balanceOf(alice.address)
        await expect(yakToken.transferFrom(alice.address, bob.address, balance)).to.revertedWith("revert Yak::transferFrom: transfer amount exceeds allowance")
      })
    })
  
    context('permit', async () => {
      it('allows a valid permit', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await yakToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, yakToken.address]
          )
        )

        const value = 123
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
                  [PERMIT_TYPEHASH, deployer.address, alice.address, value, nonce, deadline]
                )
              ),
            ]
          )
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        await yakToken.permit(deployer.address, alice.address, value, deadline, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))
        expect(await yakToken.allowance(deployer.address, alice.address)).to.eq(value)
        expect(await yakToken.nonces(deployer.address)).to.eq(1)

        await yakToken.connect(alice).transferFrom(deployer.address, bob.address, value)
      })

      it('does not allow a permit after deadline', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await yakToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, yakToken.address]
          )
        )

        const value = 123
        const nonce = await yakToken.nonces(deployer.address)
        const deadline = 0
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
                  [PERMIT_TYPEHASH, deployer.address, alice.address, value, nonce, deadline]
                )
              ),
            ]
          )
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        await expect(yakToken.permit(deployer.address, alice.address, value, deadline, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))).to.revertedWith("revert Yak::permit: signature expired")
      })
    })
  })