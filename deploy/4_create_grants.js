module.exports = async ({ deployments, getNamedAccounts }) => {
    const { log, read } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const { addGrants } = require("../scripts/addGrants")

    log(`4) Create Grants`)
    // Create grants from file
    await addGrants()
    log(`- Done creating grants`)

    log(`Deployer Balance: ${ethers.utils.formatUnits(await ethers.provider.getBalance(deployer))} AVAX`);
    log(`Deployer Balance: ${ethers.utils.formatUnits(await read('YakToken', 'balanceOf', deployer))} YAK`);
};

module.exports.skip = async function({ deployments }) {
    const { log } = deployments;
    log(`4) Create Grants`)
    log(`- Skipping step, grants already distributed`)
    return true
    // const { log, read } = deployments;
    // const { readGrantsFromFile } = require("../scripts/readFromFile")
    // const claimContract = await deployments.get("Claim");
    // const grants = readGrantsFromFile()
    // if (grants.length > 0) {
    //     const claimContractBalance = await read("YakToken", "balanceOf", claimContract.address);
    //     if (claimContractBalance.gt(0)) {
    //         log(`4) Create Grants`)
    //         log(`- Skipping step, grants already distributed`)
    //         return true
    //     } else {
    //         return false
    //     }
    // } else {
    //     log(`4) Create Grants`)
    //     log(`- Skipping step, could not find grants`)
    //     return true
    // }
}

module.exports.tags = ["4", "CreateGrants"]
module.exports.dependencies = ["3"]