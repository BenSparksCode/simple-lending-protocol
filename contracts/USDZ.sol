pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDZ is ERC20 {
    // contract with permission to mint/burn tokens
    address public controller;

    constructor(address _controller, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        controller = _controller;
    }
}
