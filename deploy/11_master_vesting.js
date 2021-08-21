module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, execute, read, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const yakToken = await deployments.get("YakToken");
  const lockManager = await deployments.get("LockManager");
  const masterYak = await deployments.get("MasterYak");

  const TEAM_VESTING_TOKENS = ethers.utils.parseUnits("1500");
  const TEAM_VESTING_DAYS = 365;

  log(`11) MasterVesting`)
  // Deploy MasterVesting contract
  const deployResult = await deploy("MasterVesting", {
    from: deployer,
    contract: "MasterVesting",
    gas: 4000000,
    args: [yakToken.address, masterYak.address, "0", lockManager.address],
    skipIfAlreadyDeployed: true
  });

  if (deployResult.newlyDeployed) {
    log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);

    // Set approval for vesting contract to transfer deployer's tokens
    await execute('YakToken', { from: deployer }, 'approve', deployResult.address, ethers.constants.MaxUint256);
    log(`- Set max approval for vesting contract at ${deployResult.address} for deployer: ${deployer}`);

    // Set lock manager role
    await execute('LockManager', { from: deployer }, 'grantRole', ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), deployResult.address);
    log(`- Grant role to ${deployResult.address} for LockManager: ${lockManager.address}`);

    // Vest team tokens
    await execute('MasterVesting', { from: deployer }, 'addTokenGrant', TEAM_VESTING_TOKENS, TEAM_VESTING_DAYS);
    log(`- Vest ${ethers.utils.formatUnits(TEAM_VESTING_TOKENS)} YAK for ${TEAM_VESTING_DAYS} days`)

    let userInfo = await read('MasterYak', 'userInfo', "0", deployResult.address);
    log(`  Balance in MasterYak: ${ethers.utils.formatUnits(userInfo.amount)} YAK`);

    log(`Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(deployer))} AVAX`);
    log(`Deployer Balance: ${ethers.utils.formatUnits(await read('YakToken', 'balanceOf', deployer))} YAK`);
  } else {
    log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
  }
};

module.exports.tags = ["11", "MasterVesting"]
module.exports.dependencies = ["10"]