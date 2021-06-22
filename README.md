# Simple Lending Protocol

## Contract System

- CollateralPool -> All collateral tokens are stored here. Internal accounting for all debt/credit managed here.
- USDZ -> Dollar-stable token, minted against collateral. Must have mint/burn managed by system contract. 
- Liquidator -> Has privileged functions to liquidate a target's position if they fall under collaterization ratio. 2 ways to do this. Maker-style auction for USDZ which gets burnt, or sell assets via SushiSwap for USDZ, and burn.
- Coordinator -> Central system manager. Keeps records of users' collateralized positions, ratios, etc. 
 
