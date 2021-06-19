const { readGrantsFromFile } = require('./readGrantsFromFile')
const { ethers, deployments } = require("hardhat");

const { log } = deployments
let vestingDurationInDays

async function addGrants(startTime) {
    const grants = readGrantsFromFile()
    const owner = await deployments.read('Vesting', 'owner');
    for(const grant of grants) {
        if (grant.class == "team") {
            vestingDurationInDays = 365
        } else if (grant.class == "partners") {
            vestingDurationInDays = 365
        } else if (grant.class == "unlocked") {
            vestingDurationInDays = 1
        } else {
            continue
        }
        const grantAmount = ethers.utils.parseUnits(grant.amount);
        log(`- Creating grant for ${grant.recipient} (class: ${grant.class}) - Total allocation: ${totalTokenAllocation}, Grant amount: ${grantAmount}`)
        await deployments.execute('Vesting', {from: owner, gasLimit: 6000000 }, 'addTokenGrant', grant.recipient, startTime, grantAmount, vestingDurationInDays);
        const newGrant = await deployments.read('Vesting', 'getTokenGrant', grant.recipient)
        log(`- New grant created for ${grant.recipient}:`)
        log(`  - Start Time: ${newGrant[0]}`)
        log(`  - Amount: ${newGrant[1]}`)
        log(`  - Duration: ${newGrant[2]}`)
    }
}

if (require.main === module) {
    addGrants(0)
}

module.exports.addGrants = addGrants