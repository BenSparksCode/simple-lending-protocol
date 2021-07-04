const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const { constants } = require("./TestConstants")

let wallet1, wallet2, wallet3, wallet4, wallet5, wallet6
let whale


describe("SushiSwap Integration Tests", function () {
    beforeEach(async () => {
        [wallet1, wallet2, wallet3, wallet4, wallet5, wallet6] = await ethers.getSigners();

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [constants.WALLETS.XSUSHI_WHALE]
        })

        whale = await ethers.provider.getSigner(constants.WALLETS.XSUSHI_WHALE)

        let bal = await whale.getBalance()
        console.log("Balance: ", bal.toString());

    })
    it("Testing some function in the contract", async () => {

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
