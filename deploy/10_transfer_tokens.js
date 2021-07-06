module.exports = async function ({ deployments, getNamedAccounts }) {
    const { log } = deployments;
    const { distributeUnlockedTokens } = require("../scripts/transferTokens")
    log(`10) Distribute Unlocked Tokens`)
    await distributeUnlockedTokens()
};

module.exports.skip = async function({ deployments, getNamedAccounts }) {
    const { log, read } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const { readTransfersFromFile } = require("../scripts/readFromFile")
    const grants = readTransfersFromFile()
    if (grants.length > 0) {
        const deployerBalance = await read("YakToken", "balanceOf", deployer.address);
        const totalSupply = await read("YakToken", "totalSupply", deployer.address);
        if (deployerBalance.lt(totalSupply)) {
            log(`10) Distribute Unlocked Tokens`)
            log(`- Skipping step, unlocked tokens already distributed`)
            return true
        } else {
            return false
        }
    } else {
        log(`10) Distribute Unlocked Tokens`)
        log(`- Skipping step, could not find grants`)
        return true
    }
}

module.exports.tags = ["10", "TransferTokens"];
module.exports.dependencies = ["1"]