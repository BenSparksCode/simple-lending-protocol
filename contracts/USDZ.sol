// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IUSDZ.sol";

contract USDZ is ERC20, IUSDZ {
    // contract with permission to mint/burn tokens
    address public controller;

    constructor(
        address _controller,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        controller = _controller;
    }

    function mint(address _account, uint256 _amount)
        external
        override
        onlyController()
    {
        _mint(_account, _amount);

        emit Mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount)
        external
        override
        onlyController()
    {
        _burn(_account, _amount);

        emit Burn(_account, _amount);
    }

    // Matching USDC's 6 decimals as USDZ will be pegged to USDC
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    modifier onlyController() {
        require(msg.sender == controller, "only controller has permission");
        _;
    }
}
