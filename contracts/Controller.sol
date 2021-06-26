pragma solidity ^0.8.0;

import "./IUSDZ.sol";

contract Controller {
    struct UserPosition {
        uint256 collateralBalance;
        uint256 mintedUSDZ;
    }

    mapping(address => uint256) xSushiBalances;

    // USDZ token address - Controller has mint/burn powers
    address public usdzAddress;

    constructor(address _usdzAddress) {
        usdzAddress = _usdzAddress;
    }

    // User deposits xSUSHI as collateral
    function deposit(uint256 _amount) public {
        // TODO make interest pool share token
        // TODO mint iPool to user
        IUSDZ usdzInstance = IUSDZ(usdzAddress);
        require(
            usdzInstance.transferFrom(msg.sender, address(this), _amount),
            "deposit transfer failed"
        );
    }

    // User withdraws xSUSHI collateral if safety ratio stays > 200%
    function withdraw(uint256 _amount) public {}
}
