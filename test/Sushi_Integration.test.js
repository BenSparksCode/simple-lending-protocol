const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const { constants } = require("./TestConstants")

let wallet1, wallet2, wallet3, wallet4, wallet5, wallet6
let whale
let owner


let USDZContract
let USDZInstance
let ControllerContract
let ControllerInstance


describe("SushiSwap Integration Tests", function () {
    beforeEach(async () => {
        [owner, wallet2, wallet3, wallet4, wallet5, wallet6] = await ethers.getSigners();

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [constants.WALLETS.XSUSHI_WHALE]
        })

        whale = await ethers.provider.getSigner(constants.WALLETS.XSUSHI_WHALE)

        let bal = await whale.getBalance()
        console.log("Balance: ", bal.toString());

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
    it("Basic borrow", async () => {

        // TODO need to approve xSUSHI first
        await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateral_one)
        await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowed_one)


    });

    // it("SushiSwap price quote", async () => {
    //     let TestContract = await ethers.getContractFactory("Test");
    //     let TestInstance = await TestContract.deploy(
    //         constants.CONTRACTS.SUSHI.ROUTER,
    //         constants.CONTRACTS.SUSHI.FACTORY,
    //         constants.CONTRACTS.TOKENS.USDC,
    //         constants.CONTRACTS.TOKENS.WETH,
    //         constants.CONTRACTS.TOKENS.XSUSHI,
    //     )

    //     res = await TestInstance.getAmountsOut(ethers.constants.WeiPerEther)
    //     console.log(res[1].div(BigNumber.from(1000000)).toString());
    // })

});
