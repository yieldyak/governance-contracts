module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer, tokenDeployer } = await getNamedAccounts();

  log(`Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(deployer))} AVAX`);
  log(`Token Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(tokenDeployer))} AVAX`);

  log(`1) Yak Token`)
  // Deploy YakToken contract
  const deployResult = await deploy("YakToken", {
    from: tokenDeployer,
    contract: "YakToken",
    gas: 4000000,
    args: [deployer],
    skipIfAlreadyDeployed: true
  });

  if (deployResult.newlyDeployed) {
    log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    log(`Token Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(tokenDeployer))} AVAX`);
  } else {
    log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
  }
};

module.exports.tags = ["1", "YakToken"]