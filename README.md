# Simple Lending Protocol

Borrow a dollar-pegged stablecoin against your productive cryptoassets (starting with xSUSHI) 🚀

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
  - calculates compound `interest` user owes on any outstanding debt from `lastBorrowed` to now (using time, not blocks)
  - calculates collateral ratio (`colRatio`) of user, given current `debt` + `interest`
  - if `colRatio` <= 200%, reverts with `"not enough collateral"`
  - if `colRatio` > 200%, user can borrow up to a 200% `colRatio`
  - calculates `borrowable` as 
  ```
  xSushiPrice * ( colRatio - 200% )
  ```
  - if `amount` > `borrowable`, reverts with `"amount too high"`
  - sets user `debt` to prev `debt` + `interest` + `amount` borrowed
  - sets user's `lastBorrowed` to now (to restart interest compounding from the new total debt figure)
  - emits `Borrow` event
- Anyone can call `liquidate()`, passing an address that has a position
  - checks if address has a position, if not reverts with `"address has no position"`
  - calculates `totalDebt` amount for address as `debt` + `interest` on the debt since `lastBorrowed`. This is a USDZ figure.
  - calculates USDC value of user's xSUSHI collateral (`xSushiPrice`) via SushiSwap.
  - calculates the `colRatio` of the address as
  ```
  ( xSushiPrice * collateral ) / totalDebt
  ```
  - if `colRatio` > 150%, reverts with `"collateral ratio still safe"`
  - if `colRatio` <= 150%, liquidation process starts
  - 90% of xSUSHI is swapped for USDC on SushiSwap
  - 8% of xSUSHI is transferred internally to protocol
  - 2% of xSUSHI is transferred internally to liquidater
  - sets user `debt` and `collateral` to `0` 
  - emits a Liquidation event

## Protocol Plan V2

- Gasless function calls
- More yield-bearing collateral assets
- Gov token that owns treasury, directs development of protocol
- Airdrop of gov token
- Borrowing earns gov tokens
- Transferring earns gov tokens
- Liquidating earns gov tokens

## Resources

- Abracadabra [Docs](https://wizard69.gitbook.io/abracadabra-money/) | [GitHub](https://github.com/Abracadabra-money/magic-internet-money/blob/main/contracts/helpers/YearnLiquidityMigrationHelper.sol)
- Aave [Docs](https://docs.aave.com/developers/) | [GitHub](https://github.com/aave/protocol-v2)
- Maker [Liquidation 2.0 Module](https://docs.makerdao.com/smart-contract-modules/dog-and-clipper-detailed-documentation)
- Uniswap V2 [Prices](https://uniswap.org/docs/v2/advanced-topics/pricing/#pricing-trades), [Swaps](https://uniswap.org/docs/v2/smart-contract-integration/trading-from-a-smart-contract/)
