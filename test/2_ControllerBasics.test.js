// -------------------------
// Basic Controller tests
// - Constructor
// - Public variables
// - Setter functions
// -------------------------

const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const { constants } = require("./TestConstants")
const { logPosition, currentTime, depositAndBorrow } = require("./TestUtils")

const ERC20_ABI = require("../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json")

let whale, whaleAddress
let owner, ownerAddress

let USDZContract
let USDZInstance
let ControllerContract
let ControllerInstance

let xSushiInstance = new ethers.Contract(
    constants.CONTRACTS.TOKENS.XSUSHI,
    ERC20_ABI.abi,
    ethers.provider
)

describe("Controller Basic tests", function () {
    beforeEach(async () => {
        [owner] = await ethers.getSigners();
        ownerAddress = await owner.getAddress()

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [constants.WALLETS.XSUSHI_WHALE]
        })
        whale = await ethers.provider.getSigner(constants.WALLETS.XSUSHI_WHALE)
        whaleAddress = constants.WALLETS.XSUSHI_WHALE

        ControllerContract = await ethers.getContractFactory("Controller")
        ControllerInstance = await ControllerContract.connect(owner).deploy(
            ethers.constants.AddressZero, // update to address after token deployed
            constants.CONTRACTS.TOKENS.USDC,
            constants.CONTRACTS.TOKENS.XSUSHI,
            constants.CONTRACTS.SUSHI.ROUTER,
            constants.PROTOCOL_PARAMS.CONTROLLER.liqTotalFee,
            constants.PROTOCOL_PARAMS.CONTROLLER.liqFeeShare,
            constants.PROTOCOL_PARAMS.CONTROLLER.interestRate,
            constants.PROTOCOL_PARAMS.CONTROLLER.borrowThreshold,
            constants.PROTOCOL_PARAMS.CONTROLLER.liquidationThreshold,
        )

        USDZContract = await ethers.getContractFactory("USDZ")
        USDZInstance = await USDZContract.deploy(
            ControllerInstance.address,
            constants.PROTOCOL_PARAMS.USDZ.name,
            constants.PROTOCOL_PARAMS.USDZ.symbol
        )

        await ControllerInstance.connect(owner).setTokenAddresses(
            constants.CONTRACTS.TOKENS.XSUSHI,
            constants.CONTRACTS.TOKENS.USDC,
            USDZInstance.address
        )
    })

    it("Constructor sets all viewable variables correctly", async () => {
        // Constructor called above in the beforeEach block
        // Addresses
        expect(await ControllerInstance.usdzAddress()).to.equal(USDZInstance.address)
        expect(await ControllerInstance.usdcAddress()).to.equal(constants.CONTRACTS.TOKENS.USDC)
        expect(await ControllerInstance.xSushiAddress()).to.equal(constants.CONTRACTS.TOKENS.XSUSHI)
        expect(await ControllerInstance.sushiRouterAddress()).to.equal(constants.CONTRACTS.SUSHI.ROUTER)
        // Fees
        expect(await ControllerInstance.liquidationFee()).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.liqTotalFee)
        expect(await ControllerInstance.liquidatorFeeShare()).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.liqFeeShare)
        expect(await ControllerInstance.interestRate()).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.interestRate)
        // Thresholds
        expect(await ControllerInstance.borrowThreshold()).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.borrowThreshold)
        expect(await ControllerInstance.liquidationThreshold()).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.liquidationThreshold)
        // xSUSHI to USDC swap path (address[])
        expect(await ControllerInstance.xSushiToUsdcPath(0)).to.equal(constants.CONTRACTS.TOKENS.XSUSHI)
        expect(await ControllerInstance.xSushiToUsdcPath(1)).to.equal(constants.CONTRACTS.TOKENS.USDC)
        // Constants
        expect(await ControllerInstance.SECONDS_IN_YEAR()).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.SECONDS_IN_YEAR_FP)
        expect(await ControllerInstance.SCALING_FACTOR()).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR)
        // check deployer is owner
        expect(await ControllerInstance.owner()).to.equal(ownerAddress)
    });
    it("getPosition() returns blank position as (0,0,0)", async () => {
        // should be publically callable without signer
        let collateral, debt, lastInterest
        [collateral, debt, lastInterest] = await ControllerInstance.getPosition(ownerAddress);
        expect(collateral).to.equal(0)
        expect(debt).to.equal(0)
        expect(lastInterest).to.equal(0)
    });
    it("getPosition() returns positive position correctly", async () => {
        // should be publically callable without signer
        let collateral, debt, lastInterest, tx, time
        [collateral, debt, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
        expect(collateral).to.equal(0)
        expect(debt).to.equal(0)
        expect(lastInterest).to.equal(0)

        await xSushiInstance.connect(whale).approve(
            ControllerInstance.address,
            constants.TEST_PARAMS.collateralOne
        )

        await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne)
        await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowedOne.mul(5))

        time = await currentTime();
        [collateral, debt, lastInterest] = await ControllerInstance.getPosition(whaleAddress)

        expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
        expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne.mul(5))
        expect(lastInterest).to.equal(time)
    });
    it.only("getCurrentCollateralRatio() returns accurate current collateral ratio", async () => {
        // should be publically callable without signer
        let colRat
        await depositAndBorrow(
            whale,
            constants.TEST_PARAMS.collateralOne,
            constants.TEST_PARAMS.borrowedOne,
            xSushiInstance,
            ControllerInstance
        )

        colRat = await ControllerInstance.getCurrentCollateralRatio(whaleAddress)
        console.log(colRat.toString());
        // TODO where to store the correct Col Rat? Need live xSUSHI price?
        expect(colRat).to.equal(0)
    });
    it("getForwardCollateralRatio() returns accurate forward collateral ratio", async () => {
        // should be publically callable without signer
    });
    it("_getCollateralRatio() should NOT be externally callable", async () => { });
    it("calcInterest() returns accurate interest for position", async () => {
        // should be publically callable without signer
    });
    it("setFeesAndRates() works as expected when called by owner", async () => { });
    it("setFeesAndRates() reverts when called by non-owner", async () => { });
    it("setThresholds() works as expected when called by owner", async () => { });
    it("setThresholds() reverts when called by non-owner", async () => { });
    it("setTokenAddresses() works as expected when called by owner", async () => { });
    it("setTokenAddresses() reverts when called by non-owner", async () => { });
    it("setSushiAddresses() works as expected when called by owner", async () => { });
    it("setSushiAddresses() reverts when called by non-owner", async () => { });
});
