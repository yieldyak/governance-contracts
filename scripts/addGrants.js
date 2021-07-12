const { readGrantsFromFile } = require('./readFromFile')
const { ethers, deployments } = require("hardhat");

const { log } = deployments

async function addGrants() {
    const grants = readGrantsFromFile()
    const owner = await deployments.read('Claim', 'owner');
    for(const grant of grants) {
        const grantAmount = ethers.utils.parseUnits(grant.amount);
        log(`- Creating grant for ${grant.recipient} - Amt: ${ethers.utils.formatUnits(grantAmount)} YAK`);

        await deployments.execute('Claim', {from: owner, gasLimit: 600000 }, 'addTokenGrant', grant.recipient, grantAmount);
        const newGrant = await deployments.read('Claim', 'getTokenGrant', grant.recipient);
        log(`  Grant created for  ${grant.recipient} - Amt: ${ethers.utils.formatUnits(newGrant)} YAK`);
    }
}

if (require.main === module) {
    addGrants()
}

module.exports.addGrants = addGrants