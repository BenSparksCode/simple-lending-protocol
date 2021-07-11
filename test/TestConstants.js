const { BigNumber } = require("@ethersproject/bignumber");
const { ethers } = require("hardhat");

const CONSTANTS = {
    TEST_PARAMS:{
        collateralOne: ethers.utils.parseUnits("10", "ether"), // 10 xSUSHI
        borrowedOne: BigNumber.from("1000000").mul(10),        // 10 USDC
        secondsInAYear: 31556952, 
    },
    PROTOCOL_PARAMS: {
        CONTROLLER: {
            SCALING_FACTOR: 10000,          // fees and rates / 10 000
            liqTotalFee: 1000,
            liqFeeShare: 200,
            interestRate: 300,
            borrowThreshold: 20000,         // 200%
            liquidationThreshold: 15000,    // 150%
        },
        USDZ: {
            name: "USDZ",
            symbol: "USDZ",
        }
    },
    CONTRACTS: {
        SUSHI: {
            // https://etherscan.io/address/0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F#code
            ROUTER: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
            // https://etherscan.io/address/0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac#code
            FACTORY: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
            // https://etherscan.io/address/0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272#code
            XSUSHI: "0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272",
            // https://etherscan.io/address/0x397FF1542f962076d0BFE58eA045FfA2d347ACa0
            USDC_WETH_POOL: "0x397FF1542f962076d0BFE58eA045FfA2d347ACa0",
            // https://etherscan.io/address/0x36e2FCCCc59e5747Ff63a03ea2e5C0c2C14911e7
            XSUSHI_WETH_POOL: "0x36e2FCCCc59e5747Ff63a03ea2e5C0c2C14911e7"
        },
        TOKENS: {
            USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            SUSHI: "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2",
            XSUSHI: "0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272",
            WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        }
    },
    WALLETS: {
        // https://etherscan.io/address/0xf977814e90da44bfa03b6295a0616a897441acec
        // Binance 8 Wallet
        XSUSHI_WHALE: "0xf977814e90da44bfa03b6295a0616a897441acec",
    }
}


module.exports = {
    constants: CONSTANTS
}