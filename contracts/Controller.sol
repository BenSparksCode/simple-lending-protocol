// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IUSDZ.sol";

contract Controller is Ownable {
    struct Position {
        uint256 collateral;
        uint256 debt;
        uint256 lastBorrowed;
    }

    mapping(address => Position) private positions;

    uint256 public protocolShortfall;

    address public usdzAddress;
    address public xSushiAddress;

    uint256 public liquidationFee;
    uint256 public liquidatorFeeShare;

    uint256 public interestRate;

    uint256 public borrowThreshold;
    uint256 public liquidationThreshold;

    uint256 public SCALING_FACTOR = 10000;

    // ---------------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------------

    event Deposit(address indexed account, uint256 amount);
    event Withdraw(address indexed account, uint256 amount);
    event Borrow(
        address indexed account,
        uint256 amountBorrowed,
        uint256 collateral,
        uint256 totalDebt
    );
    event Repay(
        address indexed account,
        uint256 debtRepaid,
        uint256 debtRemaining,
        uint256 collateral
    );
    event Liquidation(
        address indexed account,
        address indexed liquidator,
        uint256 collateralLiquidated,
        uint256 lastCollateralRatio,
        uint256 lastDebtOutstanding
    );

    // ---------------------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------------------

    constructor(
        address _usdzAddress,
        address _xSushiAddress,
        uint256 _liqTotalFee,
        uint256 _liqFeeShare,
        uint256 _interestRate,
        uint256 _borrowThreshold,
        uint256 _liqThreshold
    ) {
        usdzAddress = _usdzAddress;
        xSushiAddress = _xSushiAddress;

        // fees and rates use SCALE_FACTOR (default 10 000)
        liquidationFee = _liqTotalFee;
        liquidatorFeeShare = _liqFeeShare;
        interestRate = _interestRate;
        borrowThreshold = _borrowThreshold;
        liquidationThreshold = _liqThreshold;
    }

    // ---------------------------------------------------------------------
    // PUBLIC STATE-MODIFYING FUNCTIONS
    // ---------------------------------------------------------------------

    // User deposits xSUSHI as collateral
    function deposit(uint256 _amount) public {
        IERC20 xSUSHI = IERC20(xSushiAddress);
        require(
            xSUSHI.transferFrom(msg.sender, address(this), _amount),
            "deposit failed"
        );

        // Adding deposited collateral to position
        uint256 prevCollateral_ = positions[msg.sender].collateral;
        positions[msg.sender].collateral = prevCollateral_ + _amount;
        
        emit Deposit(msg.sender, _amount);
    }

    // User withdraws xSUSHI collateral if safety ratio stays > 200%
    function withdraw(uint256 _amount) public {
        // TODO check sender's safety ratio > 200%
        // TODO check sender has high enough balance

        emit Withdraw(msg.sender, _amount);
    }

    // User borrows USDZ against collateral
    function borrow(uint256 _amount) public {
        // TODO

        emit Borrow(msg.sender, _amount, 0, 0);
    }

    // User repays any debt in USDZ
    function repay(uint256 _amount) public {
        // TODO

        emit Repay(msg.sender, _amount, 0, 0);
    }

    // Liquidates account if collateral ratio below safety threshold
    function liquidate(address _account) public {
        // TODO


        // TODO if USDC from liquidation < account's debt - add different to protocol shortfall

        emit Liquidation(_account, msg.sender, 0, 0, 0);
    }

    // ---------------------------------------------------------------------
    // ONLY OWNER FUNCTIONS
    // ---------------------------------------------------------------------

    function setFeesAndRates(
        uint256 _liqTotalFee,
        uint256 _liqFeeShare,
        uint256 _interestRate
    ) public onlyOwner {
        // Liquidation fees
        require(
            _liqTotalFee <= SCALING_FACTOR && _liqTotalFee >= 0,
            "liqTotalFee out of range"
        );
        require(
            _liqFeeShare <= SCALING_FACTOR &&
                _liqFeeShare >= 0 &&
                _liqFeeShare <= _liqTotalFee,
            "liqFeeShare out of range"
        );
        liquidationFee = _liqTotalFee;
        liquidatorFeeShare = _liqFeeShare;

        // Interest rates
        require(
            _interestRate <= SCALING_FACTOR && _interestRate >= 0,
            "interestRate out of range"
        );
        interestRate = _interestRate;
    }

    function setThresholds(uint256 _borrowThreshold, uint256 _liqThreshold)
        public
        onlyOwner
    {
        // both thresholds should be > scaling factor
        // e.g. 20 000 / 10 000 = 200%
        require(
            _borrowThreshold >= SCALING_FACTOR,
            "borrow threshold must be > scaling factor"
        );
        require(
            _liqThreshold >= SCALING_FACTOR,
            "liq threshold must be > scaling factor"
        );
        borrowThreshold = _borrowThreshold;
        liquidationThreshold = _liqThreshold;
    }

    function setUSDZAddress(address _newAddress) external onlyOwner() {
        require(_newAddress != address(0), "usdz contract not zero address");
        usdzAddress = _newAddress;
    }

    function setXSUSHIAddress(address _newAddress) external onlyOwner() {
        require(_newAddress != address(0), "xSUSHI contract not zero address");
        xSushiAddress = _newAddress;
    }
}
