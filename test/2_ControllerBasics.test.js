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
const {
    currentTime,
    fastForward,
    depositAndBorrow,
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
            constants.CONTRACTS.TOKENS.USDC,
            constants.CONTRACTS.TOKENS.XSUSHI
        )
    })

    it("Constructor sets all viewable variables correctly", async () => {
        // Constructor called above in the beforeEach block
        // Addresses
        expect(await ControllerInstance.usdzAddress()).to.equal(USDZInstance.address)
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
        expect(await ControllerInstance.xSushiToUsdcPath(1)).to.equal(constants.CONTRACTS.TOKENS.WETH)
        expect(await ControllerInstance.xSushiToUsdcPath(2)).to.equal(constants.CONTRACTS.TOKENS.USDC)
        // Constants
        expect(await ControllerInstance.SECONDS_IN_YEAR()).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.SECONDS_IN_YEAR_FP)
        expect(await ControllerInstance.SCALING_FACTOR()).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR)
        // check deployer is owner
        expect(await ControllerInstance.owner()).to.equal(ownerAddress)
    });
    it("getPosition() returns blank position as (0,0,0,0)", async () => {
        // should be publically callable without signer
        let collateral, debt, interest, lastInterest
        [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(ownerAddress);
        expect(collateral).to.equal(0)
        expect(debt).to.equal(0)
        expect(interest).to.equal(0)
        expect(lastInterest).to.equal(0)
    });
    it("getPosition() returns positive position correctly", async () => {
        // should be publically callable without signer
        let collateral, debt, interest, lastInterest, time
        [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
        expect(collateral).to.equal(0)
        expect(debt).to.equal(0)
        expect(interest).to.equal(0)
        expect(lastInterest).to.equal(0)

        await xSushiInstance.connect(whale).approve(
            ControllerInstance.address,
            constants.TEST_PARAMS.collateralOne
        )

        await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne)
        await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowedOne)

        time = await currentTime();
        [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress)

        expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
        expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne)
        expect(interest).to.equal(0)
        expect(lastInterest).to.be.closeTo(BigNumber.from(time), constants.TEST_PARAMS.timeTolerance);
    });
    it("getCurrentCollateralRatio() returns accurate current collateral ratio", async () => {
        // should be publically callable without signer
        let colRat, expectedColRat
        await depositAndBorrow(
            whale,
            constants.TEST_PARAMS.collateralOne,
            constants.TEST_PARAMS.borrowedOne,
            xSushiInstance,
            ControllerInstance
        )

        expectedColRat = await calcCollateralRatio(10, 10)
        colRat = await ControllerInstance.getCurrentCollateralRatio(whaleAddress)
        expect(colRat).to.equal(expectedColRat)
    });
    it("getForwardCollateralRatio() returns accurate forward collateral ratio", async () => {
        // should be publically callable without signer
        let colRat, expectedColRat, debt
        await depositAndBorrow(
            whale,
            constants.TEST_PARAMS.collateralOne,
            constants.TEST_PARAMS.borrowedOne,
            xSushiInstance,
            ControllerInstance
        )

        expectedColRat = await calcCollateralRatio(10, 50)
        debt = BigNumber.from(1000000).mul(50)
        colRat = await ControllerInstance.getForwardCollateralRatio(whaleAddress, debt)
        expect(colRat).to.equal(expectedColRat)
        expectedColRat = await calcCollateralRatio(10, 153)
        debt = BigNumber.from(1000000).mul(153)
        colRat = await ControllerInstance.getForwardCollateralRatio(whaleAddress, debt)
        expect(colRat).to.equal(expectedColRat)
        expectedColRat = await calcCollateralRatio(10, 3)
        debt = BigNumber.from(1000000).mul(3)
        colRat = await ControllerInstance.getForwardCollateralRatio(whaleAddress, debt)
        expect(colRat).to.equal(expectedColRat)
    });
    it("calcInterest() returns accurate interest for position", async () => {
        // should be publically callable without signer
        let collateral, debt, interest, lastInterest, interestEnd, actualInterest, expectedInterest
        [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);

        expect(collateral).to.equal(0)
        expect(debt).to.equal(0)
        expect(interest).to.equal(0)
        expect(lastInterest).to.equal(0)

        await depositAndBorrow(
            whale,
            constants.TEST_PARAMS.collateralOne,
            constants.TEST_PARAMS.borrowedOne,
            xSushiInstance,
            ControllerInstance
        );

        [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);

        await fastForward(constants.TEST_PARAMS.secondsInAYear)

        interest = (await ControllerInstance.getPosition(whaleAddress))[2];
        actualInterest = await ControllerInstance.calcInterest(whaleAddress)
        interestEnd = await currentTime()
        expectedInterest = await calcInterest(debt, lastInterest, interestEnd);

        expect(actualInterest).to.equal(expectedInterest)   // JS-calced expected interest
        expect(actualInterest).to.equal(interest)           // interest from getPosition
    });
    it("setFeesAndRates() works as expected when called by owner", async () => {
        let liqTotalFee, liqFeeShare, interestRate

        liqTotalFee = await ControllerInstance.liquidationFee()
        liqFeeShare = await ControllerInstance.liquidatorFeeShare()
        interestRate = await ControllerInstance.interestRate()

        expect(liqTotalFee).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.liqTotalFee)
        expect(liqFeeShare).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.liqFeeShare)
        expect(interestRate).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.interestRate)

        await ControllerInstance.connect(owner).setFeesAndRates(
            765,
            432,
            987
        )

        liqTotalFee = await ControllerInstance.liquidationFee()
        liqFeeShare = await ControllerInstance.liquidatorFeeShare()
        interestRate = await ControllerInstance.interestRate()

        expect(liqTotalFee).to.equal(765)
        expect(liqFeeShare).to.equal(432)
        expect(interestRate).to.equal(987)
    });
    it("setFeesAndRates() reverts when called by non-owner", async () => {
        await expect(
            ControllerInstance.connect(whale).setFeesAndRates(0, 0, 0)
        ).to.be.revertedWith(
            constants.PROTOCOL_REVERTS.OWNABLE.notOwner
        );
    });
    it("setThresholds() works as expected when called by owner", async () => {
        let borrowThresh, liqThresh

        borrowThresh = await ControllerInstance.borrowThreshold()
        liqThresh = await ControllerInstance.liquidationThreshold()

        expect(borrowThresh).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.borrowThreshold)
        expect(liqThresh).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.liquidationThreshold)

        await ControllerInstance.connect(owner).setThresholds(
            constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR,
            constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR
        )

        borrowThresh = await ControllerInstance.borrowThreshold()
        liqThresh = await ControllerInstance.liquidationThreshold()

        expect(borrowThresh).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR)
        expect(liqThresh).to.equal(constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR)
    });
    it("setThresholds() reverts when called by non-owner", async () => {
        await expect(
            ControllerInstance.connect(whale).setThresholds(
                constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR,
                constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR
            )
        ).to.be.revertedWith(
            constants.PROTOCOL_REVERTS.OWNABLE.notOwner
        );
    });
    it("setTokenAddresses() works as expected when called by owner", async () => {
        let usdz, usdc, xsushi

        usdz = await ControllerInstance.usdzAddress()
        usdc = await ControllerInstance.usdcAddress()
        xsushi = await ControllerInstance.xSushiAddress()

        expect(usdz).to.equal(USDZInstance.address)
        expect(usdc).to.equal(constants.CONTRACTS.TOKENS.USDC)
        expect(xsushi).to.equal(constants.CONTRACTS.TOKENS.XSUSHI)

        await ControllerInstance.connect(owner).setTokenAddresses(
            constants.CONTRACTS.TOKENS.USDC,
            constants.CONTRACTS.TOKENS.XSUSHI,
            constants.CONTRACTS.TOKENS.USDC
        )

        usdz = await ControllerInstance.usdzAddress()
        usdc = await ControllerInstance.usdcAddress()
        xsushi = await ControllerInstance.xSushiAddress()

        expect(usdz).to.equal(constants.CONTRACTS.TOKENS.USDC)
        expect(usdc).to.equal(constants.CONTRACTS.TOKENS.XSUSHI)
        expect(xsushi).to.equal(constants.CONTRACTS.TOKENS.USDC)
    });
    it("setTokenAddresses() reverts when called by non-owner", async () => {
        await expect(
            ControllerInstance.connect(whale).setThresholds(
                constants.CONTRACTS.TOKENS.USDC,
                constants.CONTRACTS.TOKENS.USDC
            )
        ).to.be.revertedWith(
            constants.PROTOCOL_REVERTS.OWNABLE.notOwner
        );
    });
    it("setSushiAddresses() works as expected when called by owner", async () => {
        let router

        router = await ControllerInstance.sushiRouterAddress()
        expect(router).to.equal(constants.CONTRACTS.SUSHI.ROUTER)

        await ControllerInstance.connect(owner).setSushiAddresses(
            constants.CONTRACTS.TOKENS.USDC
        )

        router = await ControllerInstance.sushiRouterAddress()
        expect(router).to.equal(constants.CONTRACTS.TOKENS.USDC)
    });
    it("setSushiAddresses() reverts when called by non-owner", async () => {
        await expect(
            ControllerInstance.connect(whale).setSushiAddresses(
                constants.CONTRACTS.TOKENS.USDC
            )
        ).to.be.revertedWith(
            constants.PROTOCOL_REVERTS.OWNABLE.notOwner
        );
    });
});
