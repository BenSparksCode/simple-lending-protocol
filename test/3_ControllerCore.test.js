// -------------------------
// Core Controller tests
// - Deposit
// - Borrow
// - Withdraw
// - Repay
// - Events
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
    calcBorrowedGivenRatio,
    calcInterest,
    calcWithdrawable,
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
let USDCInstance = new ethers.Contract(
    constants.CONTRACTS.TOKENS.USDC,
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

    // DEPOSIT
    describe("Deposits", async () => {
        it("Standard deposit works correctly", async () => {
            // should be publically callable without signer
            let collateral, debt, interest, lastInterest
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(collateral).to.equal(0)
            expect(debt).to.equal(0)
            expect(interest).to.equal(0)
            expect(lastInterest).to.equal(0)

            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);

            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);

            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
            expect(debt).to.equal(0)
            expect(interest).to.equal(0)
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
                constants.PROTOCOL_REVERTS.ERC20.transferTooMuch
            );
        });
        it("Cannot deposit more tokens than user has approved", async () => {
            await expect(
                ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne)
            ).to.be.revertedWith(
                constants.PROTOCOL_REVERTS.ERC20.notEnoughApproved
            );
        });
        it("Multiple consecutive deposits work correctly", async () => {
            let collateral, debt, interest, lastInterest
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(collateral).to.equal(0)

            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne.mul(1))

            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne.mul(2))

            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne.mul(3))
        });
    })

    // BORROW
    describe("Borrows", async () => {
        it("Standard borrow works correctly", async () => {
            let collateral, debt, interest, lastInterest, time
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(collateral).to.equal(0)
            expect(debt).to.equal(0)
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
            expect(lastInterest).to.be.closeTo(BigNumber.from(time), constants.TEST_PARAMS.timeTolerance);
        });
        it("Can borrow exactly to threshold based on collateral", async () => {
            let collateral, debt, interest, lastInterest, maxBorrowable, time
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);

            expect(collateral).to.equal(0)
            expect(debt).to.equal(0)
            expect(lastInterest).to.equal(0)

            // Deposit 10 xSUSHI as collateral
            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);

            // Calc how much USDZ we are allowed to borrow
            maxBorrowable = await calcBorrowedGivenRatio(10, constants.PROTOCOL_PARAMS.CONTROLLER.borrowThreshold)

            await ControllerInstance.connect(whale).borrow(maxBorrowable);

            time = await currentTime();
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);

            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
            expect(debt).to.equal(maxBorrowable)
            expect(lastInterest).to.be.closeTo(BigNumber.from(time), constants.TEST_PARAMS.timeTolerance);
        })
        it("Cannot borrow more than threshold based on collateral", async () => {
            let collateral, debt, interest, lastInterest, maxBorrowable
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            // Deposit 10 xSUSHI as collateral
            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);

            // Calc how much USDZ we are allowed to borrow
            maxBorrowable = await calcBorrowedGivenRatio(10, constants.PROTOCOL_PARAMS.CONTROLLER.borrowThreshold)
            colRat = await ControllerInstance.getForwardCollateralRatio(whaleAddress, maxBorrowable.add(1))

            await expect(
                ControllerInstance.connect(whale).borrow(maxBorrowable.add(1))
            ).to.be.revertedWith(
                constants.PROTOCOL_REVERTS.CONTROLLER.borrow.notEnoughCol
            );
        });
        it("Cannot borrow zero USDZ", async () => {
            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);

            await expect(
                ControllerInstance.connect(whale).borrow(0)
            ).to.be.revertedWith(
                constants.PROTOCOL_REVERTS.CONTROLLER.borrow.cantBorrowZero
            );
        });
        it("Borrow changes interest in getPosition correctly", async () => {
            let collateral, debt, interest, lastInterest, expectedInterest
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(interest).to.equal(0)

            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);
            await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowedOne);
            await fastForward(constants.TEST_PARAMS.secondsInAYear * 10);

            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expectedInterest = await calcInterest(constants.TEST_PARAMS.borrowedOne, 0, constants.TEST_PARAMS.secondsInAYear * 10)
            expect(interest).to.be.closeTo(BigNumber.from(expectedInterest), 3);
        })
        it("Borrow changes lastInterest in getPosition correctly", async () => {
            let collateral, debt, interest, lastInterest, time
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(lastInterest).to.equal(0)

            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);
            await fastForward(1000)
            await ControllerInstance.connect(whale).borrow(1);

            time = await currentTime();
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(lastInterest).to.be.closeTo(BigNumber.from(time), constants.TEST_PARAMS.timeTolerance);

            await fastForward(5000)
            await ControllerInstance.connect(whale).borrow(1);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(lastInterest).to.be.closeTo(BigNumber.from(time + 5000), constants.TEST_PARAMS.timeTolerance);
        });
        it("Multiple consecutive borrows work correctly", async () => {
            let collateral, debt, interest, lastInterest, borrowAmount;
            borrowAmount = constants.TEST_PARAMS.borrowedOne.div(3);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(collateral).to.equal(0)
            expect(debt).to.equal(0)

            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne)

            await ControllerInstance.connect(whale).borrow(borrowAmount);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress)
            expect(debt).to.equal(borrowAmount)

            await ControllerInstance.connect(whale).borrow(borrowAmount);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress)
            expect(debt).to.equal(borrowAmount.mul(2))

            await ControllerInstance.connect(whale).borrow(borrowAmount);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress)
            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
            expect(debt).to.equal(borrowAmount.mul(3))
        });
    })

    // WITHDRAW
    describe("Withdrawals", async () => {
        beforeEach(async () => {
            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne)
        })
        it("Standard withdraw works correctly", async () => {
            let withdrawable, withdrawAmount, cBal1, wBal1, cBal2, wBal2
            cBal1 = await xSushiInstance.balanceOf(ControllerInstance.address)
            wBal1 = await xSushiInstance.balanceOf(whaleAddress)

            await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowedOne);
            withdrawable = await calcWithdrawable(whaleAddress, ControllerInstance);
            withdrawAmount = constants.TEST_PARAMS.collateralOne.div(2)

            expect(withdrawable.gt(withdrawAmount))
            // withdraw half of withdrawable
            await ControllerInstance.connect(whale).withdraw(withdrawAmount);
            cBal2 = await xSushiInstance.balanceOf(ControllerInstance.address)
            wBal2 = await xSushiInstance.balanceOf(whaleAddress)

            expect(cBal2).to.equal(cBal1.sub(withdrawAmount))
            expect(wBal2).to.equal(wBal1.add(withdrawAmount))
        });
        it("Can withdraw all collateral if zero debt", async () => {
            let collateral, debt, interest, lastInterest
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress)
            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
            expect(debt).to.equal(0)

            await ControllerInstance.connect(whale).withdraw(constants.TEST_PARAMS.collateralOne);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress)
            expect(collateral).to.equal(0)
        });
        it("Cannot withdraw more than up to safety ratio", async () => {
            let withdrawable
            await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowedOne);
            withdrawable = await calcWithdrawable(whaleAddress, ControllerInstance);

            await expect(
                ControllerInstance.connect(whale).withdraw(withdrawable.add(1))
            ).to.be.revertedWith(
                constants.PROTOCOL_REVERTS.CONTROLLER.withdraw.overWithdrawableAmount
            );
        });
        it("Multiple consecutive withdraws work correctly", async () => {
            let withdrawable, quarterWithdraw, originalCol, collateral, debt, interest, lastInterest;
            originalCol = constants.TEST_PARAMS.collateralOne;
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(collateral).to.equal(originalCol)

            await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowedOne);
            withdrawable = await calcWithdrawable(whaleAddress, ControllerInstance);
            quarterWithdraw = withdrawable.div(4);

            await ControllerInstance.connect(whale).withdraw(quarterWithdraw);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress)
            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne.sub(quarterWithdraw))

            await ControllerInstance.connect(whale).withdraw(quarterWithdraw);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress)
            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne.sub(quarterWithdraw.mul(2)))

            await ControllerInstance.connect(whale).withdraw(quarterWithdraw);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress)
            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne.sub(quarterWithdraw.mul(3)))
        });
    })

    // REPAY
    describe("Repayments", async () => {
        beforeEach(async () => {
            await USDCInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.infinity
            );
            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.infinity
            );
            await USDZInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.infinity
            );
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);
            await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowedOne);
        })
        it("Repay works for partial repayments of debt", async () => {
            let collateral, debt, interest, lastInterest, usdzBal;
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            usdzBal = await USDZInstance.balanceOf(whaleAddress);
            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
            expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne)
            expect(usdzBal).to.equal(constants.TEST_PARAMS.borrowedOne)

            await ControllerInstance.connect(whale).repay(constants.TEST_PARAMS.borrowedOne.div(2));

            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            usdzBal = await USDZInstance.balanceOf(whaleAddress);
            expect(collateral).to.equal(constants.TEST_PARAMS.collateralOne)
            expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne.div(2))
            expect(usdzBal).to.equal(constants.TEST_PARAMS.borrowedOne.div(2))
        });
        it("Repay works for full repayments of debt", async () => {
            let collateral, debt, interest, lastInterest, usdzBal;
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            usdzBal = await USDZInstance.balanceOf(whaleAddress);
            expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne)
            expect(usdzBal).to.equal(constants.TEST_PARAMS.borrowedOne)

            await ControllerInstance.connect(whale).repay(constants.TEST_PARAMS.borrowedOne);

            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            usdzBal = await USDZInstance.balanceOf(whaleAddress);
            expect(debt).to.equal(0)
            expect(usdzBal).to.equal(0)
        });
        it("Cannot repay zero", async () => {
            await expect(
                ControllerInstance.connect(whale).repay(0)
            ).to.be.revertedWith(
                constants.PROTOCOL_REVERTS.CONTROLLER.repay.cantRepayZero
            );
        });
        it("Over repaying will fully repay and refund rest", async () => {
            let collateral, debt, interest, lastInterest, usdzBal;
            // Get extra USDZ
            await ControllerInstance.connect(whale).swapUSDCforUSDZ(constants.TEST_PARAMS.borrowedOne);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            usdzBal = await USDZInstance.balanceOf(whaleAddress);
            expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne)
            expect(usdzBal).to.equal(constants.TEST_PARAMS.borrowedOne.mul(2))

            await ControllerInstance.connect(whale).repay(constants.TEST_PARAMS.borrowedOne.mul(2));

            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            usdzBal = await USDZInstance.balanceOf(whaleAddress);
            expect(debt).to.equal(0)
            expect(usdzBal).to.equal(constants.TEST_PARAMS.borrowedOne)
        });
        it("Repay closes interest to debt and clears interest", async () => {
            let collateral, debt, interest, interest2, lastInterest;
            await fastForward(constants.TEST_PARAMS.secondsInAYear * 10);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);

            await ControllerInstance.connect(whale).repay(constants.TEST_PARAMS.borrowedOne);

            [collateral, debt, interest2, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(interest).to.equal(debt)
            expect(interest2).to.equal(0)
            expect(interest.gt(0))
        });
        it("Fully repaid account will not accrue any interest", async () => {
            let collateral, debt, interest, interest2, lastInterest;
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);

            expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne)
            await ControllerInstance.connect(whale).repay(constants.TEST_PARAMS.borrowedOne);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(debt).to.equal(0)

            // wait 10 years for interest to accrue
            await fastForward(constants.TEST_PARAMS.secondsInAYear * 10);
            [collateral, debt, interest2, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(interest).to.equal(interest2)
        });
        it("Multiple consecutive partial repayments work correctly", async () => {
            let collateral, debt, interest, lastInterest, repayAmount;
            repayAmount = constants.TEST_PARAMS.borrowedOne.div(4);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne)

            await ControllerInstance.connect(whale).repay(repayAmount);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne.sub(repayAmount))

            await ControllerInstance.connect(whale).repay(repayAmount);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne.sub(repayAmount.mul(2)))

            await ControllerInstance.connect(whale).repay(repayAmount);
            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);
            expect(debt).to.equal(constants.TEST_PARAMS.borrowedOne.sub(repayAmount.mul(3)))
        });
    })

    // EVENTS
    describe("Controller Events", async () => {
        it("Deposit event emits correctly", async () => {
            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            )

            await expect(ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne))
                .to.emit(ControllerInstance, 'Deposit')
                .withArgs(whaleAddress, constants.TEST_PARAMS.collateralOne);
        });
        it("Borrow event emits correctly", async () => {
            let collateral, debt, interest, lastInterest;
            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            );
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);

            [collateral, debt, interest, lastInterest] = await ControllerInstance.getPosition(whaleAddress);

            await expect(await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowedOne))
                .to.emit(ControllerInstance, 'Borrow')
                .withArgs(whaleAddress, constants.TEST_PARAMS.borrowedOne, constants.TEST_PARAMS.borrowedOne, collateral);
        });
        it("Withdraw event emits correctly", async () => {
            let withdrawAmount = constants.TEST_PARAMS.collateralOne.div(2);
            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.collateralOne
            );
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);
            await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowedOne);

            await expect(ControllerInstance.connect(whale).withdraw(withdrawAmount))
                .to.emit(ControllerInstance, 'Withdraw')
                .withArgs(whaleAddress, withdrawAmount);
        });
        it("Repay event emits correctly", async () => {
            await xSushiInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.infinity
            );
            await USDZInstance.connect(whale).approve(
                ControllerInstance.address,
                constants.TEST_PARAMS.infinity
            );
            await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateralOne);
            await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowedOne);
            await expect(ControllerInstance.connect(whale).repay(constants.TEST_PARAMS.borrowedOne.div(4)))
                .to.emit(ControllerInstance, 'Repay')
                .withArgs(whaleAddress,
                    constants.TEST_PARAMS.borrowedOne.div(4),
                    constants.TEST_PARAMS.borrowedOne.div(4).mul(3),
                    constants.TEST_PARAMS.collateralOne
                );
        });
    })
});
