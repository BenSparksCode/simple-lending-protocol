
const logPosition = async (name, address, ControllerInstance) => {

    const pos = await ControllerInstance.getPosition(address)

    console.log("--------------------------");
    console.log("Name:\t\t", name, '('+address.substring(0,6)+"...)")
    console.log("collateral: \t", pos[0].toString());
    console.log("debt: \t\t", pos[1].toString());
    console.log("lastInterest: \t", pos[2].toString());
    console.log("--------------------------");
}


module.exports = {
    logPosition: logPosition,
}