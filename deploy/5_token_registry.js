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
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }

    const tokenRegistry = await deployments.get("TokenRegistry");
    const votingPower = new ethers.Contract(votingPowerPrism.address, votingPowerImplementation.abi, deployerSigner)
    
    if (await votingPower.tokenRegistry() !== tokenRegistry.address) {
        log(`- Setting token registry to ${tokenRegistry.address}`)
        await votingPower.setTokenRegistry(tokenRegistry.address);
    } else {
        log(`- Skipping setting token registry`)
    }
};

module.exports.tags = ["5", "TokenRegistry"];
module.exports.dependencies = ["4"]