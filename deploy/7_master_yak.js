module.exports = async function ({ ethers, getNamedAccounts, deployments }) {
    const { deploy, execute, read, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const WAVAX_REWARDS_PER_SECOND = process.env.WAVAX_REWARDS_PER_SECOND
    const WAVAX_REWARDS_START_TIMESTAMP = process.env.WAVAX_REWARDS_START_TIMESTAMP
    const WAVAX_ADDRESS = process.env.WAVAX_ADDRESS
    const MASTER_YAK_ALLOC_POINTS = process.env.MASTER_YAK_ALLOC_POINTS
    const lockManager = await deployments.get("LockManager")
    const yakToken = await deployments.get("YakToken")

    log(`7) MasterYak`)
    // Deploy MasterYak contract
    deployResult = await deploy("MasterYak", {
        from: deployer,
        contract: "MasterYak",
        gas: 4000000,
        args: [deployer, lockManager.address, WAVAX_ADDRESS, WAVAX_REWARDS_START_TIMESTAMP, WAVAX_REWARDS_PER_SECOND],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

        await execute('LockManager', { from: deployer }, 'grantRole', ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), deployResult.address);
        log(`- Grant role to ${deployResult.address} for LockManager: ${lockManager.address}`);

        await execute('MasterYak', { from: deployer }, 'add', MASTER_YAK_ALLOC_POINTS, yakToken.address, false, true);
        let numPools = await read('MasterYak', 'poolLength');
        log(`- Create YAK pool, PID ${numPools-1}`);
        log(`Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(deployer))} AVAX`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["7", "MasterYak"];
module.exports.dependencies = ["6"]