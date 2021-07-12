const { ethers } = require('hardhat');
const { BigNumber } = require("@ethersproject/bignumber");
const { constants } = require("./TestConstants")

const ERC20_ABI = require("../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json")
const SushiRouter_ABI = require("../artifacts/contracts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json")

const SCALE = constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR

const SushiRouter = new ethers.Contract(
    constants.CONTRACTS.SUSHI.ROUTER,
    SushiRouter_ABI.abi,
    ethers.provider
)

// Gets the time of the last block.
const currentTime = async () => {
    const { timestamp } = await ethers.provider.getBlock('latest');
    return timestamp;
};

// Increases the time in the EVM.
// seconds = number of seconds to increase the time by
const fastForward = async (seconds) => {
    await ethers.provider.send("evm_increaseTime", [seconds])
    await ethers.provider.send("evm_mine", [])
};

const logPosition = async (name, address, ControllerInstance) => {
    const pos = await ControllerInstance.getPosition(address)
    const colRat = await ControllerInstance.getCurrentCollateralRatio(address)

    console.log("--------------------------");
    console.log("Name: \t\t\t", name, '(' + address.substring(0, 6) + "...)")
    console.log("collateral: \t\t", pos[0].div(ethers.utils.parseUnits("1", "ether")).toString(), "xSUSHI");
    console.log("debt: \t\t\t", pos[1].div(1000000).toString(), "USDZ");
    console.log("collateral ratio: \t", colRat.div(SCALE).toString() + '%');
    console.log("last interest time: \t", pos[2].toString());
    console.log("--------------------------");
}

const depositAndBorrow = async (signer, collateral, debt, xSushiInstance, ControllerInstance) => {
    await xSushiInstance.connect(signer).approve(
        ControllerInstance.address,
        collateral
    )
    await ControllerInstance.connect(signer).deposit(collateral)
    await ControllerInstance.connect(signer).borrow(debt)
}

// returns current xSUSHI price in USDC from SushiSwap
const xSUSHIPrice = async (xsushiAmount) => {
    let res = await SushiRouter.getAmountsOut(
        ethers.utils.parseUnits(xsushiAmount + '', "ether"),
        [
            constants.CONTRACTS.TOKENS.XSUSHI,
            constants.CONTRACTS.TOKENS.WETH,
            constants.CONTRACTS.TOKENS.USDC
        ]
    )

    console.log(res[0].toString(), res[1].toString(), res[2].toString());

    return res[2]
}

const calcCollateralRatio = async (numXSushi, numUSDZ) => {
    const xsushiPrice = await xSUSHIPrice(numXSushi)
    console.log("Price:", xsushiPrice.toString());
    return (
        xsushiPrice
            .mul(constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR)
            .mul(100)
            .div(BigNumber.from(numUSDZ).mul(1000000))
    )
}


module.exports = {
    logPosition: logPosition,
    currentTime: currentTime,
    fastForward: fastForward,
    depositAndBorrow: depositAndBorrow,
    xSUSHIPrice: xSUSHIPrice,
    calcCollateralRatio: calcCollateralRatio,
}