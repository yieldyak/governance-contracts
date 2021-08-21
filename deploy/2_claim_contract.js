module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const yakToken = await deployments.get("YakToken");

    const DAYS_TO_CLAIM = process.env.DAYS_TO_CLAIM
  
    log(`2) Claim Contract`)
    // Deploy Claim contract
    const deployResult = await deploy("Claim", {
      from: deployer,
      contract: "Claim",
      gas: 4000000,
      args: [yakToken.address, DAYS_TO_CLAIM],
      skipIfAlreadyDeployed: true
    });
  
    if (deployResult.newlyDeployed) {
      log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

      // Set approval for claim contract to transfer deployer's tokens
      await execute('YakToken', { from: deployer }, 'approve', deployResult.address, ethers.constants.MaxUint256);
      log(`- Set max approval for claim contract at ${deployResult.address} for deployer: ${deployer}`);

      log(`Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(deployer))} AVAX`);
    } else {
      log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
  };

module.exports.tags = ["2", "ClaimContract"]
module.exports.dependencies = ["1"]