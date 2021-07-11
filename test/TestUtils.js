const { ethers } = require('hardhat');
const { BigNumber } = require("@ethersproject/bignumber");
const { constants } = require("./TestConstants")

const SCALE = constants.PROTOCOL_PARAMS.CONTROLLER.SCALING_FACTOR

// Gets the time of the last block.
export const currentTime = async () => {
    const { timestamp } = await ethers.provider.getBlock('latest');
    return timestamp;
};

// Increases the time in the EVM.
// seconds = number of seconds to increase the time by
export const fastForward = async (seconds) => {
    await ethers.provider.send("evm_increaseTime", [seconds])
    await ethers.provider.send("evm_mine", [])
};

const logPosition = async (name, address, ControllerInstance) => {
    const pos = await ControllerInstance.getPosition(address)
    const colRat = await ControllerInstance.getCurrentCollateralRatio(address)

    console.log("--------------------------");
    console.log("Name: \t\t\t", name, '('+address.substring(0,6)+"...)")
    console.log("collateral: \t\t", pos[0].div(ethers.utils.parseUnits("1", "ether")).toString(), "xSUSHI");
    console.log("debt: \t\t\t", pos[1].div(1000000).toString(), "USDZ");
    console.log("collateral ratio: \t", colRat.div(SCALE).toString()+'%');
    console.log("last interest time: \t", pos[2].toString());
    console.log("--------------------------");
}


module.exports = {
    logPosition: logPosition,
    currentTime: currentTime,
    fastForward: fastForward,
}