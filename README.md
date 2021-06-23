# Simple Lending Protocol

## Contract System

- CollateralPool -> All collateral tokens are stored here. Internal accounting for all debt/credit managed here.
- USDZ -> Dollar-stable token, minted against collateral. Must have mint/burn managed by system contract. 
- Liquidator -> Has privileged functions to liquidate a target's position if they fall under collaterization ratio. 2 ways to do this. Maker-style auction for USDZ which gets burnt, or sell assets via SushiSwap for USDZ, and burn.
- Coordinator -> Central system manager. Keeps records of users' collateralized positions, ratios, etc. Coordinator should also have a price oracle for USDZ, as its price could force liquidation earlir or later
- Treasury -> simple ERC20/ETH treasury controlled by owner
 
## Parameters

- 1% annual interest on all borrowings
- Collateral will be xSUSHI, yvETH to start
- Stablecoin (dollar-pegged) is called USDZ
- On liquidiation: 1% goes to liquidator, 9% to protocol treasury

## Resources

- Abracadabra -> [Docs](https://wizard69.gitbook.io/abracadabra-money/) | [GitHub](https://github.com/Abracadabra-money/magic-internet-money/blob/main/contracts/helpers/YearnLiquidityMigrationHelper.sol)
- Aave &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-> [Docs](https://docs.aave.com/developers/) | [GitHub](https://github.com/aave/protocol-v2)