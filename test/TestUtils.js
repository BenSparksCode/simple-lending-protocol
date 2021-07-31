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
    const colRat = await ControllerInstance.getForwardCollateralRatio(address, pos[1].add(pos[2]))
    console.log("--------------------------");
    console.log("Name: \t\t\t", name, '(' + address.substring(0, 6) + "...)")
    console.log("collateral: \t\t", parseFloat(pos[0].mul(100).div(ethers.utils.parseUnits("1", "ether")).toString()) / 100 + '', "xSUSHI");
    console.log("debt: \t\t\t", parseFloat(pos[1].div(10000).toString()) / 100 + '', "USDZ");
    console.log("interest: \t\t", parseFloat(pos[2].toString()) / 1000000 + '', "USDZ")
    console.log("collateral ratio: \t", colRat.div(SCALE / 100).toString() + '%');
    console.log("last interest time: \t", pos[3].toString());
    console.log("--------------------------");
}

const get3AssetBalance = async (address, xSushiInstance, USDCInstance, USDZInstance) => {
    let xsushiBal, usdcBal, usdzBal;
    xsushiBal = await xSushiInstance.balanceOf(address);
    usdcBal = await USDCInstance.balanceOf(address);
    usdzBal = await USDZInstance.balanceOf(address);

    return [xsushiBal, usdcBal, usdzBal]
}

const log3AssetBalance = async (name, address, xSushiInstance, USDCInstance, USDZInstance) => {
    const [xsushiBal, usdcBal, usdzBal] = await get3AssetBalance(address, xSushiInstance, USDCInstance, USDZInstance);
    console.log("--------------------------");
    console.log("Name: \t\t\t", name, '(' + address.substring(0, 6) + "...)")
    console.log("xSUSHI: \t\t", parseFloat(xsushiBal.mul(100).div(ethers.utils.parseUnits("1", "ether")).toString()) / 100 + '', "xSUSHI");
    console.log("USDC: \t\t\t", parseFloat(usdcBal.div(10000).toString()) / 100 + '', "USDC");
    console.log("USDZ: \t\t\t", parseFloat(usdzBal.div(10000).toString()) / 100 + '', "USDZ");
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

const createLiquidatablePosition = async (signer, xSushiNum, xSushiInstance, ControllerInstance) => {
    let collateral,maxBorrow, interest, colRat;
    collateral = ethers.utils.parseUnits(xSushiNum+"", "ether")
    await xSushiInstance.connect(signer).approve(
        ControllerInstance.address,
        collateral
    )
    await ControllerInstance.connect(signer).deposit(collateral)
    maxBorrow = await calcBorrowedGivenRatio(xSushiNum, constants.PROTOCOL_PARAMS.CONTROLLER.borrowThreshold)
    await ControllerInstance.connect(signer).borrow(maxBorrow)
    // wait time to build interest to take col rat from 200% to 149.99%
    await fastForward(9.59*31556952) // = 9.59 years in seconds
    // Uncomment to check col rat:
    interest = await ControllerInstance.calcInterest(signer.getAddress())
    colRat = await ControllerInstance.getForwardCollateralRatio(signer.getAddress(), interest.add(maxBorrow))
    console.log(colRat.toString());
    return colRat
}

// returns current xSUSHI price in USDC from SushiSwap
const xSUSHIPrice = async (xsushiAmount) => {
    let res = await SushiRouter.getAmountsOut(
        ethers.utils.parseUnits(xsushiAmount + '', "ether"),
        constants.PROTOCOL_PARAMS.CONTROLLER.xSushiToUsdcPath
    )
    return res[2]
}

const calcCollateralRatio = async (numXSushi, numUSDZ) => {
    const xsushiValue = await xSUSHIPrice(numXSushi)
    // console.log(xsushiValue.toString());
    return (
        xsushiValue
            .mul(constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR)
            .div(BigNumber.from(numUSDZ).mul(1000000))
    )
}

const calcBorrowedGivenRatio = async (numXSushi, targetColRatio) => {
    const xsushiValue = await xSUSHIPrice(numXSushi)
    // console.log(xsushiValue.toString());
    return (
        xsushiValue
            .div(targetColRatio / constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR)
    )
}

const calcInterest = async (debt, startTime, endTime) => {
    const i = constants.PROTOCOL_PARAMS.CONTROLLER.interestRate / constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR
    const duration = (endTime - toJSNum(startTime)) / constants.TEST_PARAMS.secondsInAYear
    const interest = (toJSNum(debt) * Math.pow(constants.TEST_PARAMS.e, (i * duration))) - toJSNum(debt)
    return Math.floor(interest)
}

const calcWithdrawable = async (address, ControllerInstance) => {
    // returns BigNumber Int assuming 10^18 decimals (for xSUSHI)
    let collateral, debt, interest, interestStart, currColRat, borrowThresh;
    currColRat = await ControllerInstance.getCurrentCollateralRatio(address);
    [collateral, debt, interest, interestStart] = await ControllerInstance.getPosition(address);
    currColRat = BigNumber.from(currColRat)
    collateral = BigNumber.from(collateral)
    borrowThresh = BigNumber.from(constants.PROTOCOL_PARAMS.CONTROLLER.borrowThreshold)

    // (collateral.div(currColRat)).mul(currColRat.sub(borrowThresh))
    return (collateral.div(currColRat)).mul(currColRat.sub(borrowThresh))
}

const toJSNum = (bigNum) => {
    return parseInt(bigNum.toString())
}

const burnTokenBalance = async (signer, tokenContract) => {
    const addr = await signer.getAddress()
    const bal = await tokenContract.balanceOf(addr)
    tokenContract.connect(signer).transfer("0x000000000000000000000000000000000000dEaD", bal)
}


module.exports = {
    logPosition: logPosition,
    get3AssetBalance: get3AssetBalance,
    log3AssetBalance: log3AssetBalance,
    currentTime: currentTime,
    fastForward: fastForward,
    depositAndBorrow: depositAndBorrow,
    xSUSHIPrice: xSUSHIPrice,
    calcCollateralRatio: calcCollateralRatio,
    calcBorrowedGivenRatio: calcBorrowedGivenRatio,
    calcInterest: calcInterest,
    calcWithdrawable: calcWithdrawable,
    burnTokenBalance: burnTokenBalance,
    createLiquidatablePosition: createLiquidatablePosition
}