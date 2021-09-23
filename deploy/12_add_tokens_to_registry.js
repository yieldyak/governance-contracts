module.exports = async function ({ ethers, getNamedAccounts, deployments }) {
    const { deploy, execute, read, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer, admin } = namedAccounts;
    const YRT_JLP_YAK_AVAX_ADDRESS = process.env.YRT_JLP_YAK_AVAX_ADDRESS;
    const YRT_JLP_CVR_RATE_BIPS = process.env.YRT_JLP_CVR_RATE_BIPS;
    const YRT_PGL_YAK_AVAX_ADDRESS = process.env.YRT_PGL_YAK_AVAX_ADDRESS;
    const YRT_PGL_CVR_RATE_BIPS = process.env.YRT_PGL_CVR_RATE_BIPS;
    const YRT_GDL_MYAK_YAK_ADDRESS = process.env.YRT_GDL_MYAK_YAK_ADDRESS;
    const YRT_GDL_MYAK_YAK_CVR_RATE_BIPS = process.env.YRT_GDL_MYAK_YAK_CVR_RATE_BIPS;
    const YRT_JLP_MYAK_AVAX_ADDRESS = process.env.YRT_JLP_MYAK_AVAX_ADDRESS;
    const YRT_JLP_MYAK_AVAX_CVR_RATE_BIPS = process.env.YRT_JLP_MYAK_AVAX_CVR_RATE_BIPS;

    log(`12) TokenRegistry`)

    // Deploy YakFormula contract
    let deployResult = await deploy("YRTJLPFormula", {
        from: deployer,
        contract: "UpgradableFormula",
        gas: 4000000,
        args: [admin, YRT_JLP_CVR_RATE_BIPS],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

        // await execute('TokenRegistry', {from: admin}, 'setTokenFormula', YRT_JLP_YAK_AVAX_ADDRESS, deployResult.address);
        // log(`- Token registry updated`);

        await execute('MasterYak', { from: deployer }, 'add', 0, YRT_JLP_YAK_AVAX_ADDRESS, false, true);
        numPools = await read('MasterYak', 'poolLength');
        log(`- Create YRT JLP YAK/AVAX pool, PID ${numPools-1}`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }

    // Deploy UpgradableFormula contract
    deployResult = await deploy("YRTPGLFormula", {
        from: deployer,
        contract: "UpgradableFormula",
        gas: 4000000,
        args: [admin, YRT_PGL_CVR_RATE_BIPS],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

        // await execute('TokenRegistry', {from: admin}, 'setTokenFormula', YRT_PGL_YAK_AVAX_ADDRESS, deployResult.address);
        // log(`- Token registry updated`);

        await execute('MasterYak', { from: deployer }, 'add', 0, YRT_PGL_YAK_AVAX_ADDRESS, false, true);
        numPools = await read('MasterYak', 'poolLength');
        log(`- Create YRT PGL YAK/AVAX pool, PID ${numPools-1}`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }

    // Deploy UpgradableFormula contract
    deployResult = await deploy("Formula-YRT-GDL-mYAK-YAK", {
        from: deployer,
        contract: "UpgradableFormula",
        gas: 4000000,
        args: [admin, YRT_GDL_MYAK_YAK_CVR_RATE_BIPS],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

        // await execute('TokenRegistry', {from: admin}, 'setTokenFormula', YRT_GDL_MYAK_YAK_ADDRESS, deployResult.address);
        // log(`- Token registry updated`);
        log(`- Update Token registry manually, setTokenFormula(${YRT_GDL_MYAK_YAK_ADDRESS}, ${deployResult.address})`);

        await execute('MasterYak', { from: deployer }, 'add', 0, YRT_GDL_MYAK_YAK_ADDRESS, false, true);
        numPools = await read('MasterYak', 'poolLength');
        log(`- Create YRT GDL mYAK/YAK pool, PID ${numPools-1}`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }

    // Deploy UpgradableFormula contract
    deployResult = await deploy("Formula-YRT-JLP-mYAK-AVAX", {
        from: deployer,
        contract: "UpgradableFormula",
        gas: 4000000,
        args: [admin, YRT_JLP_MYAK_AVAX_CVR_RATE_BIPS],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

        // await execute('TokenRegistry', {from: admin}, 'setTokenFormula', YRT_JLP_MYAK_AVAX_ADDRESS, deployResult.address);
        // log(`- Token registry updated`);
        log(`- Update Token registry manually, setTokenFormula(${YRT_JLP_MYAK_AVAX_ADDRESS}, ${deployResult.address})`);

        await execute('MasterYak', { from: deployer }, 'add', 0, YRT_JLP_MYAK_AVAX_ADDRESS, false, true);
        numPools = await read('MasterYak', 'poolLength');
        log(`- Create YRT JLP mYAK/AVAX pool, PID ${numPools-1}`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }

    log(`Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(deployer))} AVAX`);
};

module.exports.tags = ["12"];
module.exports.dependencies = ["8","10"]