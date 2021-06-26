// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IUSDZ.sol";

contract Controller is Ownable {
    struct UserPosition {
        uint256 collateralBalance;
        uint256 mintedUSDZ;
    }

    mapping(address => uint256) xSushiBalances;

    address public usdzAddress;
    address public xSushiAddress;

    event Deposit(
        address indexed sender,
        address indexed token,
        uint256 amount
    );
    event Withdraw(
        address indexed sender,
        address indexed token,
        uint256 amount
    );

    constructor(address _usdzAddress, address _xSushiAddress) {
        usdzAddress = _usdzAddress;
        xSushiAddress = _xSushiAddress;
    }

    // User deposits xSUSHI as collateral
    function deposit(uint256 _amount) public {
        IUSDZ usdzInstance = IUSDZ(usdzAddress);
        require(
            usdzInstance.transferFrom(msg.sender, address(this), _amount),
            "deposit transfer failed"
        );

        // TODO make interest pool share token
        // TODO mint iPool to user

        emit Deposit(msg.sender, xSushiAddress, _amount);
    }

    // User withdraws xSUSHI collateral if safety ratio stays > 200%
    function withdraw(uint256 _amount) public {
        // TODO check sender's safety ratio > 200%
        // TODO check sender has high enough balance

        emit Withdraw(msg.sender, xSushiAddress, _amount);
    }

    function setUSDZAddress(address _newAddress) external onlyOwner(){
        require(_newAddress != address(0), 'usdz contract not zero address');
        usdzAddress = _newAddress;
    }

    function setXSUSHIAddress(address _newAddress) external onlyOwner(){
        require(_newAddress != address(0), 'xSUSHI contract not zero address');
        xSushiAddress = _newAddress;
    }
}
