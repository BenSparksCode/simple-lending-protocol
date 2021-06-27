# Simple Lending Protocol

## Contract System

- USDZ -> Dollar-stable token, minted against collateral. Must have mint/burn managed by system contract. 
- Controller -> Central system manager. Keeps records of users' collateralized positions, ratios, etc. Coordinator should also have a price oracle for USDZ, as its price could force liquidation earlir or later
 
## Parameters

- 1% annual interest on all borrowings
- Collateral will be xSUSHI to start
- Stablecoin (dollar-pegged) is called USDZ
- Can borrow USDZ against collateral up to 150% collateralization ratio
- Can only withdraw collateral if col. ratio over 200%. Can't withdraw collateral that would make col. ratio < 200%
- At 125% col. ratio or lower, positions can be liquidated for the amount that would bring it back to 150% col. ratio.
- Liquidation:
  - liquidator executes ```liquidate``` or ```batchLiquidate``` on address(es) with debt position(s)
  - protocol then sells enough of the address's xSUSHI collateral, buys back enough USDZ, and burns it, such that the remaining xSUSHI collateralizes the remaining USDZ at 150%, plus an additional 10% xSUSHI as a liquidation fee.
  - Of the 10% liquidation fee, 1% goes to liquidator, 9% to protocol treasury.
- Borrowing:
  - Delay of 10 blocks between depositing collateral and borrowing (to prevent Flash Loan attacks, as USDZ will likely be very illiquid at the start). This give arbitrageurs and liquidators time to stablize USDZ at $1, or liquidate reckless reckless positions that put the solvency of the protocol at risk.
- Protocol Launch Caps:
  - To prevent whales using large positions to break the USDZ-dollar peg (a potential attack vector), some caps will be in place at launch, and may be changed by protocol governance later.
  - Collateral cap per address: $500 000 in xSUSHI.
  - Borrow cap per address: $100 000 in USDZ
  - Protocol collateral cap: $10 million in xSUSHI.
  - Protocol borrow cap: $1 million in USDZ

## Resources

- Abracadabra -> [Docs](https://wizard69.gitbook.io/abracadabra-money/) | [GitHub](https://github.com/Abracadabra-money/magic-internet-money/blob/main/contracts/helpers/YearnLiquidityMigrationHelper.sol)
- Aave &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-> [Docs](https://docs.aave.com/developers/) | [GitHub](https://github.com/aave/protocol-v2)