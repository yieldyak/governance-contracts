module.exports = async function ({ deployments, getNamedAccounts }) {
    const { log, read } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const { distributeUnlockedTokens } = require("../scripts/transferTokens")
    log(`3) Distribute Unlocked Tokens`)
    await distributeUnlockedTokens()

    log(`Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(deployer))} AVAX`);
    log(`Deployer Balance: ${ethers.utils.formatUnits(await read('YakToken', 'balanceOf', deployer))} YAK`);
};

module.exports.skip = async function({ deployments, getNamedAccounts }) {
    const { log } = deployments;
    log(`3) Distribute Unlocked Tokens`)
    log(`- Skipping step, unlocked tokens already distributed`)
    return true
    // const { log, read } = deployments;
    // const namedAccounts = await getNamedAccounts();
    // const { deployer } = namedAccounts;
    // const { readTransfersFromFile } = require("../scripts/readFromFile")
    // const grants = readTransfersFromFile()
    // if (grants.length > 0) {
    //     const deployerBalance = await read("YakToken", "balanceOf", deployer);
    //     const totalSupply = await read("YakToken", "totalSupply");
    //     if (deployerBalance.lt(totalSupply)) {
    //         log(`3) Distribute Unlocked Tokens`)
    //         log(`- Skipping step, unlocked tokens already distributed`)
    //         return true
    //     } else {
    //         return false
    //     }
    // } else {
    //     log(`3) Distribute Unlocked Tokens`)
    //     log(`- Skipping step, could not find grants`)
    //     return true
    // }
}

module.exports.tags = ["3", "TransferTokens"];
module.exports.dependencies = ["2"]