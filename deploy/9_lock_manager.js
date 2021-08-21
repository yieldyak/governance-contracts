module.exports = async function ({ ethers, getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const votingPowerImplementation = await deployments.get("VotingPower");
    const votingPowerPrism = await deployments.get("VotingPowerPrism");

    log(`9) LockManager`)
    // Deploy LockManager contract
    const deployResult = await deploy("LockManager", {
        from: deployer,
        contract: "LockManager",
        gas: 4000000,
        args: [votingPowerPrism.address, deployer],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

        // const tokenRegistry = await deployments.get("TokenRegistry");
        const deployerSigner = await ethers.getSigner(deployer)
        const votingPower = new ethers.Contract(votingPowerPrism.address, votingPowerImplementation.abi, deployerSigner)
        
        if (await votingPower.lockManager() !== deployResult.address) {
            log(`- Setting lock manager to ${deployResult.address}`)
            await votingPower.setLockManager(deployResult.address);
        } else {
            log(`- Skipping setting lock manager`)
        }
        log(`Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(deployer))} AVAX`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["9", "LockManager"];
module.exports.dependencies = ["8"]