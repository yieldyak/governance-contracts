const fs = require('fs')
const { network } = require("hardhat");

function readGrantsFromFile() {
    const file = fs.readFileSync(`./grants/airdrop-${network.name}.json`, 'utf-8')
    return JSON.parse(file)
}

function readTransfersFromFile() {
    const file = fs.readFileSync(`./grants/transfer-${network.name}.json`, 'utf-8')
    return JSON.parse(file)
}

module.exports.readGrantsFromFile = readGrantsFromFile
module.exports.readTransfersFromFile = readTransfersFromFile
