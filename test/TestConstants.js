
export const CONSTANTS = {
    PROTOCOL_PARAMS: {
        CONTROLLER: {  
            // fees and rates / 10 000
            liqTotalFee:1000,
            liqFeeShare:200,
            totalIRate:500,
            iRateShare:300,
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
            XSUSHI: "0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272"
        },
    },
    WALLETS: {
        // https://etherscan.io/address/0xf977814e90da44bfa03b6295a0616a897441acec
        // Binance 8 Wallet
        XSUSHI_WHALE: "0xf977814e90da44bfa03b6295a0616a897441acec",
    }
}