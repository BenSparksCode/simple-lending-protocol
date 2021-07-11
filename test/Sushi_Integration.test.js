const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const { constants } = require("./TestConstants")
const { logPosition } = require("./TestUtils")

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
let usdcInstance = new ethers.Contract(
    constants.CONTRACTS.TOKENS.USDC,
    ERC20_ABI.abi,
    ethers.provider
)


describe("SushiSwap Integration Tests", function () {
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
    it("Basic borrow", async () => {


        await logPosition("Whale", whaleAddress, ControllerInstance)

        await xSushiInstance.connect(whale).approve(
            ControllerInstance.address,
            constants.TEST_PARAMS.collateral_one
        )

        console.log("Depositing 10 xSUSHI as collateral...");
        await ControllerInstance.connect(whale).deposit(constants.TEST_PARAMS.collateral_one)

        console.log("Borrowing 10 USDC...");
        await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowed_one)

        await logPosition("Whale", whaleAddress, ControllerInstance)

        console.log("Borrowing 50 USDC...");
        await ControllerInstance.connect(whale).borrow(constants.TEST_PARAMS.borrowed_one.mul(5))

        await logPosition("Whale", whaleAddress, ControllerInstance)

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
