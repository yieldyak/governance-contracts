module.exports = async function ({ deployments, getNamedAccounts }) {
    const { log } = deployments;
    const { distributeUnlockedTokens } = require("../scripts/distributeUnlockedTokens")
    log(`5) Distribute Unlocked Tokens`)
    await distributeUnlockedTokens()
};

module.exports.skip = async function({ deployments, getNamedAccounts }) {
    const { log, read } = deployments
    const DAO_TREASURY_ADDRESS = process.env.DAO_TREASURY_ADDRESS
    const { readGrantsFromFile } = require("../scripts/readGrantsFromFile")
    const grants = readGrantsFromFile()
    if (grants.length > 0) {
        const treasuryTokenBalance = await read("YakToken", "balanceOf", DAO_TREASURY_ADDRESS)
        if (treasuryTokenBalance.gt(0)) {
            log(`7) Distribute Unlocked Tokens`)
            log(`- Skipping step, unlocked tokens already distributed`)
            return true
        } else {
            return false
        }
    } else {
        log(`7) Distribute Unlocked Tokens`)
        log(`- Skipping step, could not find grants`)
        return true
    }
}

module.exports.tags = ["7", "DistributeUnlockedTokens"];
module.exports.dependencies = ["6"]