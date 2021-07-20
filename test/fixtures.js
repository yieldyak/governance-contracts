const { Contract } = require("@ethersproject/contracts");
const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = require("hardhat");

const ADDRESS_PANGOLIN_FACTORY = "0xefa94DE7a4656D787667C749f7E1223D71E9FD88";
const ADDRESS_PANGOLIN = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";
const ABI_PANGOLIN_ROUTER = require("../abis/IPangolinRouter");
const ABI_PANGOLIN_FACTORY = require("../abis/IPangolinFactory");
const ABI_PANGOLIN_PAIR = require("../abis/IPangolinPair");

const INITIAL_AVAX_REWARDS_BALANCE = process.env.INITIAL_AVAX_REWARDS_BALANCE
const AVAX_REWARDS_START_TIMESTAMP = process.env.AVAX_REWARDS_START_TIMESTAMP
const AVAX_REWARDS_PER_SECOND = process.env.AVAX_REWARDS_PER_SECOND
const DAYS_TO_CLAIM = process.env.DAYS_TO_CLAIM
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const tokenFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0]
    const alice = accounts[5]
    const bob = accounts[6]
    const YakTokenFactory = await ethers.getContractFactory("YakToken");
    const YakToken = await YakTokenFactory.deploy(deployer.address);
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
    const admin = accounts[1];
    const alice = accounts[5];
    const bob = accounts[6];

    const YakTokenFactory = await ethers.getContractFactory("YakToken");
    const YakToken = await YakTokenFactory.deploy(deployer.address);

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

    return {
        yakToken: YakToken,
        votingPower: VotingPower,
        votingPowerImplementation: VotingPowerImp,
        votingPowerPrism: VotingPowerPrism,
        lockManager: LockManager,
        deployer: deployer,
        admin: admin,
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
    const YakToken = await YakTokenFactory.deploy(deployer.address);
    const ClaimFactory = await ethers.getContractFactory("Claim");
    const Claim = await ClaimFactory.deploy(YakToken.address, DAYS_TO_CLAIM);

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
    const YakToken = await YakTokenFactory.deploy(deployer.address); // deployer has 10k

    const WavaxTokenFactory = await ethers.getContractFactory("WAVAX");
    const WavaxToken = await WavaxTokenFactory.deploy();

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
    
    const MasterYakFactory = await ethers.getContractFactory("MasterYak");
    const MasterYak = await MasterYakFactory.deploy(deployer.address, LockManager.address, AVAX_REWARDS_START_TIMESTAMP, AVAX_REWARDS_PER_SECOND)
    await LockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), MasterYak.address)

    const MasterVestingFactory = await ethers.getContractFactory("MasterVesting");
    const MasterVesting = await MasterVestingFactory.deploy(YakToken.address, MasterYak.address, "0", LockManager.address);
    await LockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), MasterVesting.address)

    return {
        yakToken: YakToken,
        wavaxToken: WavaxToken,
        votingPower: VotingPower,
        lockManager: LockManager,
        masterVesting: MasterVesting,
        masterYak: MasterYak,
        deployer: deployer,
        alice: alice,
        bob: bob,
        ZERO_ADDRESS: ZERO_ADDRESS
    };
})

const liquidityFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const alice = accounts[5];
    const bob = accounts[6];

    const LIQUIDITY_TO_ADD = ethers.utils.parseUnits("100");

    const YakTokenFactory = await ethers.getContractFactory("YakToken");
    const YakToken = await YakTokenFactory.deploy(deployer.address); // deployer has 10k

    const WavaxTokenFactory = await ethers.getContractFactory("WAVAX");
    const WavaxToken = await WavaxTokenFactory.deploy();
    await WavaxToken.deposit({ value: LIQUIDITY_TO_ADD });

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
    
    const MasterYakFactory = await ethers.getContractFactory("MasterYak");
    const MasterYak = await MasterYakFactory.deploy(deployer.address, LockManager.address, AVAX_REWARDS_START_TIMESTAMP, AVAX_REWARDS_PER_SECOND)
    await LockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), MasterYak.address)

    const MasterVestingFactory = await ethers.getContractFactory("MasterVesting");
    const MasterVesting = await MasterVestingFactory.deploy(YakToken.address, MasterYak.address, "0", LockManager.address);
    await LockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), MasterVesting.address)

    // await WavaxToken.approve(MasterYak.address, INITIAL_AVAX_REWARDS_BALANCE);
    await MasterYak.addRewardsBalance({ value: INITIAL_AVAX_REWARDS_BALANCE });
    await MasterYak.add("10", YakToken.address, true, true);

    const PangolinRouter = new Contract(ADDRESS_PANGOLIN, ABI_PANGOLIN_ROUTER, deployer);
    await YakToken.approve(PangolinRouter.address, LIQUIDITY_TO_ADD);
    await WavaxToken.approve(PangolinRouter.address, LIQUIDITY_TO_ADD);
    await PangolinRouter.addLiquidity(
        YakToken.address,
        WavaxToken.address,
        LIQUIDITY_TO_ADD,
        LIQUIDITY_TO_ADD,
        LIQUIDITY_TO_ADD,
        LIQUIDITY_TO_ADD,
        deployer.address,
        parseInt(new Date() / 1000) + 600
    );

    const PangolinFactory = new Contract(ADDRESS_PANGOLIN_FACTORY, ABI_PANGOLIN_FACTORY, deployer);
    const pairAddress = await PangolinFactory.getPair(YakToken.address, WavaxToken.address);
    const PangolinPair = new Contract(pairAddress, ABI_PANGOLIN_PAIR, deployer);
    let token0 = await PangolinPair.token0();
    let token1 = await PangolinPair.token1();

    const FarmFactory = await ethers.getContractFactory("MasterYakStrategy");
    const Farm = await FarmFactory.deploy(
        "Yield Yak: PGL YAK-AVAX",
        PangolinPair.address,
        WavaxToken.address,
        MasterYak.address,
        token0 == YakToken.address ? PangolinPair.address : ZERO_ADDRESS,
        token1 == YakToken.address ? PangolinPair.address : ZERO_ADDRESS,
        "1"
    );

    return {
        yakToken: YakToken,
        wavaxToken: WavaxToken,
        tokenRegistry: TokenRegistry,
        votingPower: VotingPower,
        lockManager: LockManager,
        masterVesting: MasterVesting,
        masterYak: MasterYak,
        router: PangolinRouter,
        pair: PangolinPair,
        factory: PangolinFactory,
        farm: Farm,
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
module.exports.liquidityFixture = liquidityFixture;