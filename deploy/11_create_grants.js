module.exports = async ({ deployments }) => {
    const { log } = deployments;
    const { addGrants } = require("../scripts/addGrants")

    log(`11) Create Grants`)
    // Create grants from file
    await addGrants()
    log(`- Done creating grants`)
};

module.exports.skip = async function({ deployments }) {
    const { log, read } = deployments;
    const { readGrantsFromFile } = require("../scripts/readFromFile")
    const claimContract = await deployments.get("Claim");
    const grants = readGrantsFromFile()
    if (grants.length > 0) {
        const claimContractBalance = await read("YakToken", "balanceOf", claimContract.address);
        if (claimContractBalance.gt(0)) {
            log(`11) Create Grants`)
            log(`- Skipping step, grants already distributed`)
            return true
        } else {
            return false
        }
    } else {
        log(`11) Create Grants`)
        log(`- Skipping step, could not find grants`)
        return true
    }
}

module.exports.tags = ["11", "CreateGrants"]
module.exports.dependencies = ["10", "7"]