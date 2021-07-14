// -------------------------
// Core Controller tests
// - Deposit
// - Borrow
// - Withdraw
// - Repay
// -------------------------

const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const { constants } = require("./TestConstants")
const {
    logPosition,
    currentTime,
    fastForward,
    depositAndBorrow,
    xSUSHIPrice,
    calcCollateralRatio,
    calcInterest
} = require("./TestUtils")

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

describe.only("Controller Core tests", function () {
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
            constants.CONTRACTS.TOKENS.XSUSHI,
            constants.CONTRACTS.SUSHI.ROUTER,
            constants.PROTOCOL_PARAMS.CONTROLLER.xSushiToUsdcPath,
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
            USDZInstance.address,
            constants.CONTRACTS.TOKENS.XSUSHI
        )
    })

    // DEPOSIT
    describe.only("Deposits", async () => {
        it("Standard deposit works correctly", async () => {});
        it("Cannot deposit more tokens than user owns", async () => {});
        it("Cannot deposit more tokens than user has approved", async () => {});
        it("Multiple consecutive deposits work correctly", async () => {});
    })

    // BORROW
    describe.only("Borrows", async () => {
        it("Standard borrow works correctly", async () => {});
        it("Cannot borrow more than threshold based on collateral", async () => {});
        it("Cannot borrow zero USDZ", async () => {});
        it("Borrow changes lastInerest correctly", async () => {});
        it("Multiple consecutive borrows work correctly", async () => {});
    })

    // WITHDRAW
    describe.only("Withdrawals", async () => {
        it("Standard withdraw works correctly", async () => {});
        it("Can withdraw all collateral if zero debt", async () => {});
        it("Cannot withdraw more than up to safety ratio", async () => {});
        it("Multiple consecutive withdraws work correctly", async () => {});
    })

    // REPAY
    describe.only("Repayments", async () => {
        it("", async () => {});
    })

    // EVENTS
    describe.only("Controller Events", async () => {
        it("Deposit event emits correctly", async () => {});
        it("Borrow event emits correctly", async () => {});
        it("Withdraw event emits correctly", async () => {});
        it("Repay event emits correctly", async () => {});
        it("Liquidation event emits correctly", async () => {});
    })
});
