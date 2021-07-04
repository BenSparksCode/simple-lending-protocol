// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";
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
    address public usdcAddress;
    address public xSushiAddress;
    address public sushiRouterAddress;

    address[] public xSushiToUsdcPath;

    uint256 public liquidationFee;
    uint256 public liquidatorFeeShare;

    uint256 public interestRate;

    uint256 public borrowThreshold;
    uint256 public liquidationThreshold;

    uint256 public immutable SCALING_FACTOR = 10000;

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
        address _usdcAddress,
        address _xSushiAddress,
        address _routerAddress,
        uint256 _liqTotalFee,
        uint256 _liqFeeShare,
        uint256 _interestRate,
        uint256 _borrowThreshold,
        uint256 _liqThreshold
    ) {
        usdzAddress = _usdzAddress;
        usdcAddress = _usdcAddress;
        xSushiAddress = _xSushiAddress;
        sushiRouterAddress = _routerAddress;

        // fees and rates use SCALE_FACTOR (default 10 000)
        liquidationFee = _liqTotalFee;
        liquidatorFeeShare = _liqFeeShare;
        interestRate = _interestRate;
        borrowThreshold = _borrowThreshold;
        liquidationThreshold = _liqThreshold;

        // building xSUSHI-USDC SushiSwap pricing path
        xSushiToUsdcPath = new address[](2);
        xSushiToUsdcPath[0] = _xSushiAddress;
        xSushiToUsdcPath[1] = _usdcAddress;
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
        uint256 startingCollateral_ = positions[msg.sender].collateral;

        require(
            startingCollateral_ >= _amount,
            "not enough collateral in account"
        );

        // TODO add interest to debt first in helper fn

        uint256 colRatio = getCollateralRatio(msg.sender);

        require(
            colRatio > borrowThreshold,
            "collateral ratio is <= borrow threshold"
        );

        uint256 withdrawable_ = ((colRatio -
            (borrowThreshold / SCALING_FACTOR)) / type(uint256).max) *
            startingCollateral_;

        require(
            withdrawable_ >= _amount,
            "withdraw less of collateral ratio becomes unsafe"
        );

        positions[msg.sender].collateral = startingCollateral_ - _amount;

        require(
            IERC20(xSushiAddress).transfer(msg.sender, _amount),
            "withdraw transfer failed"
        );

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
    // HELPER FUNCTIONS
    // ---------------------------------------------------------------------

    // Calculates collateral ratio of an account.
    // Assumes debt is in USDZ, and 1 USDZ = 1 USDC, and collateral is in xSUSHI
    function getCollateralRatio(address _account)
        public
        view
        returns (uint256)
    {
        uint256 collateral_ = positions[_account].collateral;
        uint256 debt_ = positions[_account].debt;

        if (collateral_ == 0) {
            // if collateral is 0, col ratio is 0 and no borrowing possible
            return 0;
        } else if (debt_ == 0) {
            // if debt is 0, col ratio is infinite
            return type(uint256).max;
        }
        require(collateral_ > 0, "");
        IUniswapV2Router02 router = IUniswapV2Router02(sushiRouterAddress);
        uint256 collateralValue_ = router.getAmountsOut(
            collateral_,
            xSushiToUsdcPath
        )[1];
        // col. ratio = collateral USDC value / debt USDC value
        // E.g. 2:1 will return 200
        return (collateralValue_ * SCALING_FACTOR) / debt_;
    }

    function calcInterest(address _account) public view returns (uint256 interest) {
        uint256 debt_ = positions[_account].debt;
        uint256 lastBorrowed_ = positions[_account].lastBorrowed;
        if(debt_ == 0 || lastBorrowed_ == 0){
            return 0;
        }

        // TODO add some fancy floating point math
        // continous compound interest = P*e^(i*t)
        uint256 interest_;

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
