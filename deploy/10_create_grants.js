module.exports = async ({ deployments }) => {
    const { log } = deployments;
    const { addGrants } = require("../scripts/addGrants")

    log(`6) Create Grants`)
    // Create grants from file
    await addGrants(0)
    log(`- Done creating grants`)
};

module.exports.skip = async function({ deployments }) {
    const { log } = deployments
    log(`6) Create Grants`)
    log(`- Skipping step, grants already created`)
    return true
}

module.exports.tags = ["6", "CreateGrants"]
module.exports.dependencies = ["5"]