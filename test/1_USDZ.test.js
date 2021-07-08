// -------------------------
// USDZ Token tests
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

describe("Basic tests", function () {
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
    it("Controller address is correctly set and viewable", async () => {});
    it("Decimals is correctly set and viewable", async () => {});
    it("Controller can mint", async () => {});
    it("Non-controller can't mint", async () => {});
    it("Controller can burn", async () => {});
    it("Non-controller can't burn", async () => {});
    it("Mint event emits correctly", async () => {});
    it("Burn event emits correctly", async () => {});
    
    // TODO add Permit and transferWithAuthorization
    // https://github.com/CoinbaseStablecoin/eip-3009/blob/master/test/EIP3009.test.ts
});
