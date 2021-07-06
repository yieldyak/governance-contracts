module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const yakToken = await deployments.get("YakToken");
  
    log(`8) Claim Contract`)
    // Deploy Claim contract
    const deployResult = await deploy("Claim", {
      from: deployer,
      contract: "Claim",
      gas: 4000000,
      args: [yakToken.address],
      skipIfAlreadyDeployed: true
    });
  
    if (deployResult.newlyDeployed) {
      log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
      log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
  };

module.exports.tags = ["8", "ClaimContract"]
module.exports.dependencies = ["1"]