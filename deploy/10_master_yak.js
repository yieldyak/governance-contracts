module.exports = async function ({ ethers, getNamedAccounts, deployments }) {
    const { deploy, execute, read, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const INITIAL_AVAX_REWARDS_BALANCE = process.env.INITIAL_AVAX_REWARDS_BALANCE
    const AVAX_REWARDS_PER_SECOND = process.env.AVAX_REWARDS_PER_SECOND
    const AVAX_REWARDS_START_TIMESTAMP = process.env.AVAX_REWARDS_START_TIMESTAMP
    const MASTER_YAK_ALLOC_POINTS = process.env.MASTER_YAK_ALLOC_POINTS
    const MASTER_YAK_PGL_ALLOC_POINTS = process.env.MASTER_YAK_PGL_ALLOC_POINTS
    const PGL_YAK_AVAX_ADDRESS = process.env.PGL_YAK_AVAX_ADDRESS;
    const lockManager = await deployments.get("LockManager")
    const yakToken = await deployments.get("YakToken")

    log(`10) MasterYak`)
    // Deploy MasterYak contract
    deployResult = await deploy("MasterYak", {
        from: deployer,
        contract: "MasterYak",
        gas: 4000000,
        args: [deployer, lockManager.address, AVAX_REWARDS_START_TIMESTAMP, AVAX_REWARDS_PER_SECOND],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

        await execute('LockManager', { from: deployer }, 'grantRole', ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), deployResult.address);
        log(`- Grant role to ${deployResult.address} for LockManager: ${lockManager.address}`);

        await execute('MasterYak', { from: deployer }, 'add', MASTER_YAK_ALLOC_POINTS, yakToken.address, false, true);
        let numPools = await read('MasterYak', 'poolLength');
        log(`- Create YAK pool, PID ${numPools-1}`);

        await execute('MasterYak', { from: deployer }, 'add', MASTER_YAK_PGL_ALLOC_POINTS, PGL_YAK_AVAX_ADDRESS, false, true);
        numPools = await read('MasterYak', 'poolLength');
        log(`- Create YAK/AVAX pool, PID ${numPools-1}`);

        await execute('MasterYak', { from: deployer, value: INITIAL_AVAX_REWARDS_BALANCE }, 'addRewardsBalance');
        let rewardsPerSecond = await read('MasterYak', 'rewardsPerSecond');
        log(`- Rewards per Second ${ethers.utils.formatUnits(rewardsPerSecond)}`);

        log(`Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(deployer))} AVAX`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["10", "MasterYak"];
module.exports.dependencies = ["9"]