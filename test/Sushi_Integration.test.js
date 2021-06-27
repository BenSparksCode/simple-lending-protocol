const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");

import {CONSTANTS} from "./TestConstants"

let wallet1, wallet2, wallet3, wallet4, wallet5, wallet6
let whale


describe("SushiSwap Integration Tests", function () {
    beforeEach(async () => {
        [wallet1, wallet2, wallet3, wallet4, wallet5, wallet6] = await ethers.getSigners();

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [CONSTANTS.WALLETS.XSUSHI_WHALE]
        })

        whale = await ethers.provider.getSigner(CONSTANTS.WALLETS.XSUSHI_WHALE)
    
    })
    it("Testing some function in the contract", async () => {
        
    });

    
    // const signer = await ethers.provider.getSigner("0xab5801a7d398351b8be11c439e05c5b3259aec9b")

    // let bal = await signer.getBalance()
    // let block = await ethers.provider.getBlock()

    // console.log("Vitalik's balance at block ", block.number)
    // console.log(ethers.utils.formatUnits(bal, "ether"), "ETH")
    // console.log("\n\nINITIATE RUG\n\n")

    // const tx = await signer.sendTransaction({
    //     to: ethers.constants.AddressZero,
    //     value: ethers.constants.WeiPerEther,
    // })

    // bal = await signer.getBalance()
    // block = await ethers.provider.getBlock()

    // console.log("Vitalik's balance at block ", block.number)
    // console.log(ethers.utils.formatUnits(bal, "ether"), "ETH")
    
});
