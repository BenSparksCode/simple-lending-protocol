# Simple Lending Protocol

## Contract System

- ```USDZ```
  - Dollar-stable token, minted against collateral.
  - Mint/burn managed by Controller.
- ```Controller```
  - Central system manager.
  - Keeps records of users' collateralized positions, ratios, etc.
  - Keeps track of USDZ and xSUSHI prices using SushiSwap TWAP
  - Has ability to liquidate undercollateralized positions
 
## Protocol Plan V1

MVP version, for educational purposes. Not intended for real financial use. 

- Protocol Parameters:
  - 3% annual interest on all borrowings
  - Collateral will be xSUSHI to start
  - Stablecoin (dollar-pegged) is called USDZ
  - Can borrow USDZ against collateral up to 150% collateralization ratio
  - At 150% col. ratio or lower, positions can be liquidated for the amount that would bring it back to 150% col. ratio.
  - Can only withdraw collateral if col. ratio over 200%. Can't withdraw collateral that would make col. ratio < 200%
- Liquidation:
  - To keep things simple, liquidation will market sell the entire xSUSHI collateral via SushiSwap for USDC. USDC will then be redeemable 1:1 with USDZ. This should keep USDZ approx dollar-pegged even if it has very little trade volume.
  - liquidator executes ```liquidate``` or ```batchLiquidate``` on address(es) with debt position(s)
  - when liquidating a position, 10% of the xSUSHI is diverted as a liquidation fee, and the remaining 90% is swapped for USDC.
  - Of the 10% liquidation fee: 2% goes to liquidator, 8% to protocol treasury.
- Borrowing:
  - Delay of 10 blocks between depositing collateral and borrowing (to prevent Flash Loan attacks, as USDZ will likely be very illiquid at the start).

### The Lend-Borrow Accounting Process

- User deposits xSUSHI by approving, then calling `deposit()`
  - stores amount of xSUSHI deposited, as `collateral`
  - emits Deposit event
- User can then call `borrow()`, passing `amount` to borrow
  - calculates USDC value of user's xSUSHI collateral (`xSushiPrice`) via SushiSwap
  - calculates collateral ratio (`colRatio`) of user, given current `debt`
  - if `colRatio` <= 200%, reverts with `"not enough collateral"`
  - if `colRatio` > 200%, user can borrow up to a 200% `colRatio`
  - calculates `borrowable` as 
  ```
  xSushiPrice * ( colRatio - 200% )
  ```
  - if `amount` > `borrowable`, reverts with `"amount too high"`
  - TODO complete
  - sets user `debt` to the amount of USDZ borrowed
  - emits `Borrow` event
- Anyone can call `liquidate()`, passing an address that has a position
  - checks if address has a position, if not reverts with `"address has no position"`
  - TODO complete

## Protocol Plan V2

Some form of governance token and DAO will be established to develop the protocol after a public version is ready and deployed.

- Governance:
  - There will be a completely valueless governance token for the protocol. Ticker to be decided. GOV used as a placeholder. 
  - GOV can be locked for different periods, in exchange for veGOV (shout out to [Curve](https://curve.readthedocs.io/dao-vecrv.html)).
  - GOV lockers get more veGOV, the longer they lock up the GOV for.
  - 1 veGOV = 1 vote in governance issues.
  - Protocol earnings are directed to 2 different accounts: 70% operating funds, and 30% staking rewards. veGOV tokens represent a share of the staking rewards pool.
  - veCRV holders also vote on how the operating funds are used.
- GOV Token Distribution:
  - 10% founding team allocation, vested for 2 years
  - 25% of supply airdropped to DeFi users
  - 30% operating fund, linear unlocks for 2 years
  - 35% liquidity mining rewards for 2 years
- Protocol Launch Caps:
  - To prevent whales using large positions to break the USDZ-dollar peg (a potential attack vector), some caps will be in place at launch, and may be changed by protocol governance later.
  - Protocol collateral cap: $10 million in xSUSHI.
  - Protocol borrow cap: $2 million in USDZ.

## Resources

- Abracadabra [Docs](https://wizard69.gitbook.io/abracadabra-money/) | [GitHub](https://github.com/Abracadabra-money/magic-internet-money/blob/main/contracts/helpers/YearnLiquidityMigrationHelper.sol)
- Aave [Docs](https://docs.aave.com/developers/) | [GitHub](https://github.com/aave/protocol-v2)
- Maker [Liquidation 2.0 Module](https://docs.makerdao.com/smart-contract-modules/dog-and-clipper-detailed-documentation)
- Uniswap V2 [Prices](https://uniswap.org/docs/v2/advanced-topics/pricing/#pricing-trades), [Swaps](https://uniswap.org/docs/v2/smart-contract-integration/trading-from-a-smart-contract/)