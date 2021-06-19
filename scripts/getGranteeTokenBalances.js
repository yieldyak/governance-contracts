const { readGrantsFromFile } = require('./readGrantsFromFile')
const { ethers, deployments } = require("hardhat");

const { read } = deployments;

async function fetchTokenBalances() {
    const grants = readGrantsFromFile()
    let granteeBalances = []
    for(const grant of grants) {
        const tokenAllocation = ethers.utils.parseUnits(grant.amount)
        const granteeBalance = await read('YakToken', 'balanceOf', grant.recipient)
        const granteeGrant = await read('Vesting', 'getTokenGrant', grant.recipient)
        granteeBalances.push({
            'recipient': grant.recipient,
            'class': grant.class,
            'initialTotalBalance': tokenAllocation.toString(),
            'grantAmount': granteeGrant.amount.toString(),
            'claimedBalance': granteeGrant.totalClaimed.toString(),
            'currentBalance': granteeBalance.toString()
        })
    }
    return granteeBalances
}

async function printTokenBalances() {
    const granteeBalances = await fetchTokenBalances()
    for(const balance of granteeBalances){
        console.log(`-----------------------------------------------------`)
        console.log(`Recipient: ${balance.recipient}`)
        console.log(`Class: ${balance.class}`)
        console.log(`Initial Total Balance: ${balance.initialTotalBalance}`)
        console.log(`Grant Amount: ${balance.grantAmount}`)
        console.log(`Claimed Balance: ${balance.claimedBalance}`)
        console.log(`Current Balance: ${balance.currentBalance}`)
    }
    console.log(`-----------------------------------------------------`)
}

if (require.main === module) {
    printTokenBalances()
}

module.exports.fetchTokenBalances = fetchTokenBalances
module.exports.printTokenBalances = printTokenBalances