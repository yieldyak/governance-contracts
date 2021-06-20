const { ethers, deployments } = require("hardhat");
const { log } = deployments;
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS
const WAVAX_ABI = require("../abis/WAVAX.json");
const WAVAX_ADDRESS = process.env.WAVAX_ADDRESS;
const INITIAL_WAVAX_REWARDS_BALANCE = process.env.INITIAL_WAVAX_REWARDS_BALANCE
const FORK_URL = process.env.FORK_URL

async function configureMasterYak() {
    if(FORK_URL && FORK_URL.length > 0) {
        await ethers.provider.send('hardhat_impersonateAccount', [DEPLOYER_ADDRESS]);
        const deployer = await ethers.getSigner(DEPLOYER_ADDRESS)

        const YakTokenDeployment = await deployments.get("YakToken")
        const MasterYakDeployment = await deployments.get("MasterYak")
        const LockManagerDeployment = await deployments.get("LockManager")
        const TokenRegistry = await deployments.get("TokenRegistry")
        const VestingDeployment = await deployments.get("Vesting")
        const VotingPowerImpDeployment = await deployments.get("VotingPower")
        const VotingPowerPrismDeployment = await deployments.get("VotingPowerPrism")

        const WavaxToken = new ethers.Contract(WAVAX_ADDRESS, WAVAX_ABI, deployer)
        const YakToken = new ethers.Contract(YakTokenDeployment.address, YakTokenDeployment.abi, deployer)
        const LockManager = new ethers.Contract(LockManagerDeployment.address, LockManagerDeployment.abi, deployer)
        const VotingPowerImp = new ethers.Contract(VotingPowerImpDeployment.address, VotingPowerImpDeployment.abi, deployer)
        const VotingPowerPrism = new ethers.Contract(VotingPowerPrismDeployment.address, VotingPowerPrismDeployment.abi, deployer)
        const VotingPower = new ethers.Contract(VotingPowerPrismDeployment.address, VotingPowerImpDeployment.abi, deployer)
        const MasterYak = new ethers.Contract(MasterYakDeployment.address, MasterYakDeployment.abi, deployer)
        const Vesting = new ethers.Contract(VestingDeployment.address, VestingDeployment.abi, deployer)

        await VotingPowerPrism.setPendingProxyImplementation(VotingPowerImpDeployment.address);
        await VotingPowerImp.become(VotingPowerPrism.address);
        await VotingPower.setLockManager(LockManager.address)
        await VotingPower.setTokenRegistry(TokenRegistry.address)
        await LockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), MasterYak.address)
        await LockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), Vesting.address)
        await WavaxToken.approve(MasterYak.address, INITIAL_WAVAX_REWARDS_BALANCE)
        await MasterYak.addRewardsBalance(INITIAL_WAVAX_REWARDS_BALANCE)
    } else {
        log("Must configure manually using multi-sig")
    }
}

if (require.main === module) {
    configureMasterYak()
}

module.exports.configureMasterYak = configureMasterYak
