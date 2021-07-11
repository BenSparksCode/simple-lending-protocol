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
const { logPosition } = require("./TestUtils")

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

        await ControllerInstance.connect(owner).setUSDZAddress(USDZInstance.address)
    })
    
    it("Constructor sets up contract properly", async () => {});
    it("Integer variables are publically viewable", async () => {});
    it("Address variables are publically veiwable", async () => {});
    it("Address[] variables are publically viewable", async () => {});
    it("getPosition() returns accurate position", async () => {
        // should be publically callable without signer
    });
    it("getCurrentCollateralRatio() returns accurate current collateral ratio", async () => {
        // should be publically callable without signer
    });
    it("getForwardCollateralRatio() returns accurate forward collateral ratio", async () => {
        // should be publically callable without signer
    });
    it("_getCollateralRatio() should NOT be externally callable", async () => {});
    it("calcInterest() returns accurate interest for position", async () => {
        // should be publically callable without signer
    });
    it("setFeesAndRates() works as expected when called by owner", async () => {});
    it("setFeesAndRates() reverts when called by non-owner", async () => {});
    it("setThresholds() works as expected when called by owner", async () => {});
    it("setThresholds() reverts when called by non-owner", async () => {});
    it("setTokenAddresses() works as expected when called by owner", async () => {});
    it("setTokenAddresses() reverts when called by non-owner", async () => {});
    it("setSushiAddresses() works as expected when called by owner", async () => {});
    it("setSushiAddresses() reverts when called by non-owner", async () => {});
    it("", async () => {});
    it("", async () => {});
    it("", async () => {});
});
