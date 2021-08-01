// -------------------------
// Liquidation tests
// - Liquidations
// - Liquidation Events
// -------------------------

const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const { constants } = require("./TestConstants")
const {
    logPosition,
    get3AssetBalance,
    log3AssetBalance,
    xSUSHIPrice,
    currentTime,
    fastForward,
    calcBorrowedGivenRatio,
    calcInterest,
    calcWithdrawable,
    burnTokenBalance,
    createLiquidatablePosition
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
let USDCInstance = new ethers.Contract(
    constants.CONTRACTS.TOKENS.USDC,
    ERC20_ABI.abi,
    ethers.provider
)

describe.only("Liquidation tests", function () {
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
            constants.CONTRACTS.TOKENS.USDC,
            constants.CONTRACTS.TOKENS.XSUSHI,
            constants.CONTRACTS.SUSHI.ROUTER,
            constants.PROTOCOL_PARAMS.CONTROLLER.xSushiToUsdcPath,
            constants.PROTOCOL_PARAMS.CONTROLLER.liqFeeProtocol,
            constants.PROTOCOL_PARAMS.CONTROLLER.liqFeeSender,
            constants.PROTOCOL_PARAMS.CONTROLLER.interestRate,
            constants.PROTOCOL_PARAMS.CONTROLLER.borrowThreshold,
            constants.PROTOCOL_PARAMS.CONTROLLER.liqThreshold,
        )

        USDZContract = await ethers.getContractFactory("USDZ")
        USDZInstance = await USDZContract.deploy(
            ControllerInstance.address,
            constants.PROTOCOL_PARAMS.USDZ.name,
            constants.PROTOCOL_PARAMS.USDZ.symbol
        )
        await ControllerInstance.connect(owner).setTokenAddresses(
            USDZInstance.address,
            constants.CONTRACTS.TOKENS.USDC,
            constants.CONTRACTS.TOKENS.XSUSHI
        )
    })
    it("Liquidate works under standard liquidation conditions", async () => {
        let xsushiBal, usdcBal, usdzBal, collateral, debt, interest, lastInterest, borrowed, estInterest;
        await createLiquidatablePosition(whale, 10, xSushiInstance, ControllerInstance);
        [xsushiBal, usdcBal, usdzBal] = await get3AssetBalance(
            ControllerInstance.address,
            xSushiInstance,
            USDCInstance,
            USDZInstance
        );
        [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
        borrowed = await calcBorrowedGivenRatio(10, constants.PROTOCOL_PARAMS.CONTROLLER.borrowThreshold)
        estInterest = BigNumber.from(await calcInterest(borrowed, 0, 9.59 * 31556952))
        expect(xsushiBal).to.equal(constants.TEST_PARAMS.collateralOne)
        expect(usdcBal).to.equal(0)
        expect(usdzBal).to.equal(0)
        expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
        expect(debt).to.be.closeTo(borrowed, 1000000) // within $1
        expect(interest).to.be.closeTo(estInterest, 100000) // within 1 cent

        await ControllerInstance.connect(alice).liquidate(whaleAddress);

        [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
        [xsushiBal, usdcBal, usdzBal] = await get3AssetBalance(
            ControllerInstance.address,
            xSushiInstance,
            USDCInstance,
            USDZInstance
        );
        expect(xsushiBal).to.equal(constants.TEST_PARAMS.collateralOne.div(10))
        expect(usdcBal).to.be.closeTo(await xSUSHIPrice(9), 10000) // within 1 USDC cent
        expect(usdzBal).to.equal(0)
        expect(collateral).to.equal(0)
        expect(debt).to.equal(0)
        expect(interest).to.equal(0)
    });
    it("Owner can liquidate a borrower's position", async () => {
        let collateral, debt, interest, lastInterest, borrowed, estInterest;
        await createLiquidatablePosition(whale, 10, xSushiInstance, ControllerInstance);
        [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
        borrowed = await calcBorrowedGivenRatio(10, constants.PROTOCOL_PARAMS.CONTROLLER.borrowThreshold)
        estInterest = BigNumber.from(await calcInterest(borrowed, 0, 9.59 * 31556952))
        expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
        expect(debt).to.be.closeTo(borrowed, 1000000) // within $1
        expect(interest).to.be.closeTo(estInterest, 100000) // within 1 cent

        await ControllerInstance.connect(owner).liquidate(whaleAddress);

        [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
        expect(collateral).to.equal(0)
        expect(debt).to.equal(0)
        expect(interest).to.equal(0)
    });
    // it("Random user can liquidate a borrower's position", async () => { });
    // it("Borrower can liquidate their own position", async () => { });
    // it("Cannot liquidate if target address has no position", async () => { });
    // it("Cannot liquidate if position is above borrow ratio", async () => { });
    // it("Cannot liquidate if position is between borrow and liquidation ratios", async () => { });
    // it("Cannot liquidate if position is exactly at liquidation ratio", async () => { });
    // it("Liquidation charges fee correctly", async () => { });
    // it("Liquidation accounts for shortfall correctly", async () => { });
    // it("Liquidation rewards liquidator correctly", async () => { });
    // it("Liquidation fee is transferred to the protocol", async () => { });
    // it("Liquidate works with 10 xSUSHI collateral", async () => { });
    // it("Liquidate works with 1000 xSUSHI collateral", async () => { });
    // it("Liquidate works with 345 801 xSUSHI collateral", async () => { });
    // it("After liquidated, borrower's debt, interest, and collateral are zero", async () => { });
    // it("Liquidation event emits correctly", async () => { });

    // test isLiquidatable
    // test liquidator receives fees
    // test protocol receives fees
});
