const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = require("hardhat");

const INITIAL_WAVAX_REWARDS_BALANCE = process.env.INITIAL_WAVAX_REWARDS_BALANCE
const WAVAX_REWARDS_START_TIMESTAMP = process.env.WAVAX_REWARDS_START_TIMESTAMP
const WAVAX_REWARDS_PER_SECOND = process.env.WAVAX_REWARDS_PER_SECOND
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const tokenFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0]
    const alice = accounts[5]
    const bob = accounts[6]
    const YakTokenFactory = await ethers.getContractFactory("YakToken");
    const YakToken = await YakTokenFactory.deploy();
    return {
        yakToken: YakToken,
        deployer: deployer,
        alice: alice,
        bob: bob,
        ZERO_ADDRESS: ZERO_ADDRESS
    };
})

const governanceFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const alice = accounts[5];
    const bob = accounts[6];

    const YakTokenFactory = await ethers.getContractFactory("YakToken");
    const YakToken = await YakTokenFactory.deploy();

    const VotingPowerFactory = await ethers.getContractFactory("VotingPower");
    const VotingPowerImp = await VotingPowerFactory.deploy();
    const VotingPowerPrismFactory = await ethers.getContractFactory("VotingPowerPrism");
    const VotingPowerPrism = await VotingPowerPrismFactory.deploy(deployer.address);
    await VotingPowerPrism.setPendingProxyImplementation(VotingPowerImp.address);
    const VotingPower = new ethers.Contract(VotingPowerPrism.address, VotingPowerImp.interface, deployer);
    await VotingPowerImp.become(VotingPower.address);
    await VotingPower.initialize(YakToken.address);

    const YakFormulaFactory = await ethers.getContractFactory("YakFormula");
    const YakFormula = await YakFormulaFactory.deploy()
    const TokenRegistryFactory = await ethers.getContractFactory("TokenRegistry");
    const TokenRegistry = await TokenRegistryFactory.deploy(deployer.address, [YakToken.address], [YakFormula.address])
    await VotingPower.setTokenRegistry(TokenRegistry.address)

    const LockManagerFactory = await ethers.getContractFactory("LockManager");
    const LockManager = await LockManagerFactory.deploy(VotingPower.address, deployer.address);
    await VotingPower.setLockManager(LockManager.address);

    const VestingFactory = await ethers.getContractFactory("Vesting");
    const Vesting = await VestingFactory.deploy(deployer.address, YakToken.address, LockManager.address);
    await LockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), Vesting.address)

    return {
        yakToken: YakToken,
        vesting: Vesting,
        votingPower: VotingPower,
        votingPowerImplementation: VotingPowerImp,
        votingPowerPrism: VotingPowerPrism,
        lockManager: LockManager,
        deployer: deployer,
        alice: alice,
        bob: bob,
        ZERO_ADDRESS: ZERO_ADDRESS
    };
});

const airdropFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const alice = accounts[5];
    const bob = accounts[6];

    const YakTokenFactory = await ethers.getContractFactory("YakToken");
    const YakToken = await YakTokenFactory.deploy();
    const ClaimFactory = await ethers.getContractFactory("Claim");
    const Claim = await ClaimFactory.deploy(YakToken.address);

    return {
        yakToken: YakToken,
        claim: Claim,
        deployer: deployer,
        alice: alice,
        bob: bob,
        ZERO_ADDRESS: ZERO_ADDRESS
    };
});

const rewardsFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const alice = accounts[5];
    const bob = accounts[6];

    const YakTokenFactory = await ethers.getContractFactory("YakToken");
    const YakToken = await YakTokenFactory.deploy(); // deployer has 10k

    const WavaxTokenFactory = await ethers.getContractFactory("WAVAX");
    const WavaxToken = await WavaxTokenFactory.deploy();
    await WavaxToken.deposit({ value: INITIAL_WAVAX_REWARDS_BALANCE });

    await YakToken.transfer(alice.address, ethers.utils.parseUnits("100"))
    await YakToken.transfer(bob.address, ethers.utils.parseUnits("100"))
    await deployer.sendTransaction({ to: alice.address, value: ethers.utils.parseUnits("1")})
    await deployer.sendTransaction({ to: bob.address, value: ethers.utils.parseUnits("1")})
    
    const VotingPowerFactory = await ethers.getContractFactory("VotingPower");
    const VotingPowerImp = await VotingPowerFactory.deploy();
    const VotingPowerPrismFactory = await ethers.getContractFactory("VotingPowerPrism");
    const VotingPowerPrism = await VotingPowerPrismFactory.deploy(deployer.address);
    await VotingPowerPrism.setPendingProxyImplementation(VotingPowerImp.address);
    const VotingPower = new ethers.Contract(VotingPowerPrism.address, VotingPowerImp.interface, deployer);
    await VotingPowerImp.become(VotingPower.address);
    await VotingPower.initialize(YakToken.address);

    const YakFormulaFactory = await ethers.getContractFactory("YakFormula");
    const YakFormula = await YakFormulaFactory.deploy()
    const TokenRegistryFactory = await ethers.getContractFactory("TokenRegistry");
    const TokenRegistry = await TokenRegistryFactory.deploy(deployer.address, [YakToken.address], [YakFormula.address])
    await VotingPower.setTokenRegistry(TokenRegistry.address)

    const LockManagerFactory = await ethers.getContractFactory("LockManager");
    const LockManager = await LockManagerFactory.deploy(VotingPower.address, deployer.address)
    await VotingPower.setLockManager(LockManager.address);
    
    const RewardsManagerFactory = await ethers.getContractFactory("RewardsManager");
    const RewardsManager = await RewardsManagerFactory.deploy(deployer.address, LockManager.address, WavaxToken.address, WAVAX_REWARDS_START_TIMESTAMP, WAVAX_REWARDS_PER_SECOND)
    const VestingFactory = await ethers.getContractFactory("Vesting");
    const Vesting = await VestingFactory.deploy(deployer.address, YakToken.address, LockManager.address);
    await LockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), RewardsManager.address)
    await LockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), Vesting.address)

    await WavaxToken.approve(RewardsManager.address, INITIAL_WAVAX_REWARDS_BALANCE);

    return {
        yakToken: YakToken,
        wavaxToken: WavaxToken,
        votingPower: VotingPower,
        lockManager: LockManager,
        rewardsManager: RewardsManager,
        deployer: deployer,
        alice: alice,
        bob: bob,
        ZERO_ADDRESS: ZERO_ADDRESS
    };
})

module.exports.tokenFixture = tokenFixture;
module.exports.governanceFixture = governanceFixture;
module.exports.airdropFixture  = airdropFixture;
module.exports.rewardsFixture = rewardsFixture;