const hre = require("hardhat");

const { constants } = require("../test/TestConstants")

async function main() {

  // When deploying:
  // 1. Deploy Controller
  // 2. Deploy USDZ - pass Controller as authority address
  // 3. Set USDZ address in Controller
  // 4. Deployer swaps 100 000 USDC for 100 000 USDZ in Swapper to seed pool

  console.log("DONE");

}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
