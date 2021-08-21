const { readGrantsFromFile } = require('./readFromFile')
const { ethers, deployments } = require("hardhat");

const { log } = deployments

async function addGrants() {
    const grants = readGrantsFromFile()
    const owner = await deployments.read('Claim', 'owner');

    let i = 0;
    const batchSize = 200;
    while (i < grants.length) {
        let grantAmounts = [];
        let grantRecipients = [];
        let totalTokens = ethers.BigNumber.from("0");
        let batchIndex = i + batchSize < grants.length ? i + batchSize : grants.length;
        console.log(i, batchSize, batchIndex, grants.length);
        for (i; i < batchIndex; i++) {
            totalTokens = totalTokens.add(String(grants[i].amount));
            grantAmounts.push(String(grants[i].amount));
            grantRecipients.push(grants[i].recipient);
        }
        log(`- Creating grants for ${grantRecipients.length} recipients - Amt: ${ethers.utils.formatUnits(totalTokens)} YAK`);
        await deployments.execute('Claim', {from: owner, gasLimit: 8000000 }, 'addTokenGrants', grantRecipients, grantAmounts, totalTokens);
    }
}

if (require.main === module) {
    addGrants()
}

module.exports.addGrants = addGrants