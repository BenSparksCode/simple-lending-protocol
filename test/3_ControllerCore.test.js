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
    calcInterest,
    burnTokenBalance
} = require("./TestUtils")

const ERC20_ABI = require("../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json")

let whale, whaleAddress
let alice, aliceAddress
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

describe("Controller Core tests", function () {
    beforeEach(async () => {
        [owner, alice] = await ethers.getSigners();
        ownerAddress = await owner.getAddress()
        aliceAddress = await alice.getAddress()

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
        it("Standard deposit works correctly", async () => {
            // should be publically callable without signer
            let collateral, debt, lastInterest, time
            [collateral, debt, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(collateral).to.equal(0)
            expect(debt).to.equal(0)
            expect(lastInterest).to.equal(0)

            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);

            [collateral, debt, lastInterest] = await ControllerInstance.getPosition(whaleAddress);

            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
            expect(debt).to.equal(0)
            expect(lastInterest).to.equal(0)

        });
        it("Cannot deposit more tokens than user owns", async () => {
            await burnTokenBalance(alice, xSushiInstance)
            let bal = await xSushiInstance.balanceOf(aliceAddress)
            // send alice some xSUSHI
            await xSushiInstance.connect(whale).transfer(
                aliceAddress,
                constants.TEST_PARAMS.collateralOne
            )

            bal = await xSushiInstance.balanceOf(aliceAddress)
            await expect(bal).to.equal(constants.TEST_PARAMS.collateralOne)

            await expect(
                ControllerInstance.connect(alice).deposit(constants.TEST_PARAMS.collateralOne.add(1))
            ).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });
        it("Cannot deposit more tokens than user has approved", async () => { });
        it("Multiple consecutive deposits work correctly", async () => { });
    })

    // BORROW
    describe("Borrows", async () => {
        it("Standard borrow works correctly", async () => { });
        it("Cannot borrow more than threshold based on collateral", async () => { });
        it("Cannot borrow zero USDZ", async () => { });
        it("Borrow changes lastInerest correctly", async () => { });
        it("Multiple consecutive borrows work correctly", async () => { });
    })

    // WITHDRAW
    describe("Withdrawals", async () => {
        it("Standard withdraw works correctly", async () => { });
        it("Can withdraw all collateral if zero debt", async () => { });
        it("Cannot withdraw more than up to safety ratio", async () => { });
        it("Multiple consecutive withdraws work correctly", async () => { });
    })

    // REPAY
    describe("Repayments", async () => {
        it("Repay works for partial repayments of debt", async () => { });
        it("Repay works for full repayments of debt", async () => { });
        it("Cannot repay zero", async () => { });
        it("Over repaying will fully repay and refund rest", async () => { });
        it("Fully repaid account will not accrue any interest", async () => { });
        it("Multiple consecutive partial repayments work correctly", async () => { });
    })

    // EVENTS
    describe("Controller Events", async () => {
        it("Deposit event emits correctly", async () => { });
        it("Borrow event emits correctly", async () => { });
        it("Withdraw event emits correctly", async () => { });
        it("Repay event emits correctly", async () => { });
        it("Liquidation event emits correctly", async () => { });
    })
});
