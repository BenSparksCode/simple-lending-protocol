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

let owner, ownerAddress

let USDZContract
let USDZInstance
let ControllerContract
let ControllerInstance

describe("Controller Basic tests", function () {
    beforeEach(async () => {
        [owner] = await ethers.getSigners();
        ownerAddress = await owner.getAddress()

        ControllerContract = await ethers.getContractFactory("Controller")
        ControllerInstance = await ControllerContract.connect(owner).deploy(
            ethers.constants.AddressZero, // update to address after deploy
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

    it.only("Constructor sets up contract properly", async () => {
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
    it("Integer variables are publically viewable", async () => { });
    it("Address variables are publically veiwable", async () => { });
    it("Address[] variables are publically viewable", async () => { });
    it("getPosition() returns accurate position", async () => {
        // should be publically callable without signer
    });
    it("getCurrentCollateralRatio() returns accurate current collateral ratio", async () => {
        // should be publically callable without signer
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
