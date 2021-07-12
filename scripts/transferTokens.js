const { readTransfersFromFile } = require('./readFromFile')
const { ethers, deployments, getNamedAccounts } = require("hardhat");

const { log } = deployments;

async function distributeUnlockedTokens() {
    const { deployer } = await getNamedAccounts();
    log(`- Distributing unlocked tokens...`)

    const grants = readTransfersFromFile()
    for(const grant of grants) {
        const grantAmount = ethers.utils.parseUnits(grant.amount);
        log(`- Transfering tokens to ${grant.recipient} - Amt: ${ethers.utils.formatUnits(grantAmount)} YAK`);

        await deployments.execute('YakToken', {from: deployer, gasLimit: 100000 }, 'transfer', grant.recipient, grantAmount);
        const newGrant = await deployments.read('YakToken', 'balanceOf', grant.recipient);
        log(`  Tokens transferred to ${grant.recipient} - Bal: ${ethers.utils.formatUnits(newGrant)} YAK`);
    }
}

if (require.main === module) {
    distributeUnlockedTokens()
}

module.exports.distributeUnlockedTokens = distributeUnlockedTokens