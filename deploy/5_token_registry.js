module.exports = async function ({ ethers, getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer, admin } = namedAccounts;
    const yakToken = await deployments.get("YakToken");
    const votingPowerImplementation = await deployments.get("VotingPower");
    const votingPowerPrism = await deployments.get("VotingPowerPrism");

    log(`5) TokenRegistry`)
    // Deploy YakFormula contract
    let deployResult = await deploy("YakFormula", {
        from: deployer,
        contract: "YakFormula",
        gas: 4000000,
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }

    const yakFormula = await deployments.get("YakFormula")

    // Deploy Token Registry contract
    deployResult = await deploy("TokenRegistry", {
        from: deployer,
        contract: "TokenRegistry",
        gas: 4000000,
        args: [admin, [yakToken.address], [yakFormula.address]],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

        // const tokenRegistry = await deployments.get("TokenRegistry");
        const deployerSigner = await ethers.getSigner(deployer)
        const votingPower = new ethers.Contract(votingPowerPrism.address, votingPowerImplementation.abi, deployerSigner)
        
        if (await votingPower.tokenRegistry() !== deployResult.address) {
            log(`- Setting token registry to ${deployResult.address}`)
            await votingPower.setTokenRegistry(deployResult.address);
        } else {
            log(`- Skipping setting token registry`)
        }
        log(`Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(deployer))} AVAX`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["5", "TokenRegistry"];
module.exports.dependencies = ["4"]