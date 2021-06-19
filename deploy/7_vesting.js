module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, execute, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const yakToken = await deployments.get("YakToken");
  const lockManager = await deployments.get("LockManager");

  log(`2) Vesting`)
  // Deploy vesting contract
  const deployResult = await deploy("Vesting", {
    from: deployer,
    contract: "Vesting",
    gas: 4000000,
    args: [deployer.address, yakToken.address, lockManager.address],
    skipIfAlreadyDeployed: true
  });

  if (deployResult.newlyDeployed) {
    log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

    // Set approval for vesting contract to transfer deployer's tokens
    await execute('YakToken', { from: deployer }, 'approve', deployResult.address, ethers.constants.MaxUint256);
    log(`- Set max approval for vesting contract at ${deployResult.address} for deployer: ${deployer}`)
  } else {
    log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
  }
};

module.exports.tags = ["2", "Vesting"]
module.exports.dependencies = ["1"]