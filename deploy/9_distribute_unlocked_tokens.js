module.exports = async function ({ deployments, getNamedAccounts }) {
    const { log } = deployments;
    const { distributeUnlockedTokens } = require("../scripts/distributeUnlockedTokens")
    log(`9) Distribute Unlocked Tokens`)
    await distributeUnlockedTokens()
};

module.exports.skip = async function({ deployments, getNamedAccounts }) {
    const { log, read } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const { readGrantsFromFile } = require("../scripts/readGrantsFromFile")
    const grants = readGrantsFromFile()
    if (grants.length > 0) {
        const deployerBalance = await read("YakToken", "balanceOf", deployer.address);
        const totalSupply = await read("YakToken", "totalSupply", deployer.address);
        if (deployerBalance.lt(totalSupply)) {
            log(`9) Distribute Unlocked Tokens`)
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

module.exports.tags = ["9", "DistributeUnlockedTokens"];
module.exports.dependencies = ["1"]