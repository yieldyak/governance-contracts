module.exports = async function ({ ethers, getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer, admin } = namedAccounts;
    const WAVAX_REWARDS_PER_SECOND = process.env.WAVAX_REWARDS_PER_SECOND
    const WAVAX_REWARDS_START_TIMESTAMP = process.env.WAVAX_REWARDS_START_TIMESTAMP
    const WAVAX_ADDRESS = process.env.WAVAX_ADDRESS
    const lockManager = await deployments.get("LockManager")

    log(`15) RewardsManager`)
    // Deploy RewardsManager contract
    deployResult = await deploy("RewardsManager", {
        from: deployer,
        contract: "RewardsManager",
        gas: 4000000,
        args: [admin, lockManager.address, WAVAX_ADDRESS, WAVAX_REWARDS_START_TIMESTAMP, WAVAX_REWARDS_PER_SECOND],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["10", "RewardsManager"];
module.exports.dependencies = ["9"]