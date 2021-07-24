// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface IUSDZ is IERC20 {
    function mint(address _account, uint256 _amount) external;
    function burn(address _account, uint256 _amount) external;

    event Mint(address indexed account, uint256 amount);
    event Burn(address indexed account, uint256 amount);
}