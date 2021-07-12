require("@nomiclabs/hardhat-waffle");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require('hardhat-abi-exporter');
require('hardhat-log-remover');
require("hardhat-gas-reporter");

const AVALANCHE_MAINNET_URL = process.env.AVALANCHE_MAINNET_URL;
const AVALANCHE_FUJI_URL = process.env.AVALANCHE_FUJI_URL;

const FORK_URL = process.env.FORK_URL
const FORK_BLOCK_NUMBER = process.env.FORK_BLOCK_NUMBER
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
const TOKEN_DEPLOYER_PRIVATE_KEY = process.env.TOKEN_DEPLOYER_PRIVATE_KEY
const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS;

// Default Hardhat network config
let hardhatConfig = {
  chainId: 43114,
  gasPrice: 225000000000,
  live: false,
  saveDeployments: true
}

// If FORK_URL env var is set, enable forking on Hardhat network
// Documentation: https://hardhat.org/hardhat-network/#mainnet-forking
if (FORK_URL && FORK_URL.length > 0) {
  hardhatConfig.forking = {}
  hardhatConfig.forking.url = FORK_URL
  // If FORK_BLOCK_NUMBER env var is set, create fork from specific block
  if (FORK_BLOCK_NUMBER && parseInt(FORK_BLOCK_NUMBER)) {
    hardhatConfig.forking.blockNumber = parseInt(FORK_BLOCK_NUMBER)
  }
}

let fujiConfig = {
  url: AVALANCHE_FUJI_URL,
  chainId: 43113,
  live: true,
  saveDeployments: true
}

let mainnetConfig = {
  url: AVALANCHE_MAINNET_URL,
  chainId: 43114,
  live: true,
  saveDeployments: true
}

if (DEPLOYER_PRIVATE_KEY && DEPLOYER_PRIVATE_KEY.length > 0) {
  fujiConfig.accounts = [DEPLOYER_PRIVATE_KEY]
  mainnetConfig.accounts = [DEPLOYER_PRIVATE_KEY]

  if (TOKEN_DEPLOYER_PRIVATE_KEY && TOKEN_DEPLOYER_PRIVATE_KEY.length > 0) {
    fujiConfig.accounts.push(TOKEN_DEPLOYER_PRIVATE_KEY)
    mainnetConfig.accounts.push(TOKEN_DEPLOYER_PRIVATE_KEY)
  }
}

// Hardhat Config
// Documentation: https://hardhat.org/config/
// Deploy add-ons: https://hardhat.org/plugins/hardhat-deploy.html
module.exports = {
  solidity: {
    version: "0.7.3",
    settings: {
      optimizer: {
        enabled: true,
        runs: 9999
      }
    }
  },
  mocha: {
    timeout: 350000
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: hardhatConfig,
    fuji: fujiConfig,
    mainnet: mainnetConfig
  },
  namedAccounts: {
    deployer: {
      default: 0
    },
    tokenDeployer: {
      default: 1
    },
    admin: {
      default: 3,
      "hardhat": ADMIN_ADDRESS,
      "fuji": ADMIN_ADDRESS,
      "mainnet": ADMIN_ADDRESS
    }
  },
  paths: {
    deploy: 'deploy',
    deployments: 'deployments',
    imports: `imports`
  },
  abiExporter: {
    path: './abis',
    clear: true,
    flat: true
  },
  gasReporter: {
    enabled: true,
    showTimeSpent: true
  }
};