const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");

let wallet1, wallet2, wallet3, wallet4, wallet5, wallet6

describe("Contract Tests", function () {
    beforeEach(async () => {
        [wallet1, wallet2, wallet3, wallet4, wallet5, wallet6] = await ethers.getSigners();
    })
    it("Testing some function in the contract", async () => {

    });
    
});
