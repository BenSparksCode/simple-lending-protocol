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

    uint256 public liquidationFee;
    uint256 public liquidatorFeeShare;

    uint256 public interestRate;
    uint256 public lenderIRateShare;

    uint256 public FEE_RATE_SCALING_FACTOR = 10000;

    // ---------------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------------

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

    // ---------------------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------------------

    constructor(
        address _usdzAddress,
        address _xSushiAddress,
        uint256 _liqTotalFee,
        uint256 _liqFeeShare,
        uint256 _totalIRate,
        uint256 _iRateShare
    ) {
        usdzAddress = _usdzAddress;
        xSushiAddress = _xSushiAddress;

        // fees and rates use SCALE_FACTOR (default 10 000)
        liquidationFee = _liqTotalFee;
        liquidatorFeeShare = _liqFeeShare;
        interestRate = _totalIRate;
        lenderIRateShare = _iRateShare;
    }

    // ---------------------------------------------------------------------
    // EXTERNAL STATE-MODIFYING FUNCTIONS
    // ---------------------------------------------------------------------

    function setUSDZAddress(address _newAddress) external onlyOwner() {
        require(_newAddress != address(0), "usdz contract not zero address");
        usdzAddress = _newAddress;
    }

    function setXSUSHIAddress(address _newAddress) external onlyOwner() {
        require(_newAddress != address(0), "xSUSHI contract not zero address");
        xSushiAddress = _newAddress;
    }

    // ---------------------------------------------------------------------
    // PUBLIC STATE-MODIFYING FUNCTIONS
    // ---------------------------------------------------------------------

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

    // ---------------------------------------------------------------------
    // ONLY OWNER FUNCTIONS
    // ---------------------------------------------------------------------

    function setFeesAndRates(
        uint256 _liqTotalFee,
        uint256 _liqFeeShare,
        uint256 _totalIRate,
        uint256 _iRateShare
    ) public onlyOwner {
        // Liquidation fees
        require(
            _liqTotalFee <= FEE_RATE_SCALING_FACTOR && _liqTotalFee >= 0,
            "liqTotalFee out of range"
        );
        require(
            _liqFeeShare <= FEE_RATE_SCALING_FACTOR &&
                _liqFeeShare >= 0 &&
                _liqFeeShare <= _liqTotalFee,
            "liqFeeShare out of range"
        );
        liquidationFee = _liqTotalFee;
        liquidatorFeeShare = _liqFeeShare;

        // Interest rates
        require(
            _totalIRate <= FEE_RATE_SCALING_FACTOR && _totalIRate >= 0,
            "totalIRate out of range"
        );
        require(
            _iRateShare <= FEE_RATE_SCALING_FACTOR &&
                _iRateShare >= 0 &&
                _iRateShare <= _totalIRate,
            "iRateShare out of range"
        );
        interestRate = _totalIRate;
        lenderIRateShare = _iRateShare;
    }
}
