// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./utils/ABDKMath64x64.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./IUSDZ.sol";

contract Controller is Ownable {
    // using ABDKMath64x64 for int128;

    struct Position {
        uint256 collateral;
        uint256 debt;
        uint256 lastInterest;
    }

    mapping(address => Position) private positions;

    uint256 public protocolShortfall;

    address public usdzAddress;
    address public xSushiAddress;
    address public sushiRouterAddress;

    address[] public xSushiToUsdcPath;

    uint256 public liquidationFee;
    uint256 public liquidatorFeeShare;

    uint256 public interestRate;

    uint256 public borrowThreshold;
    uint256 public liquidationThreshold;

    uint256 public constant SCALING_FACTOR = 10000;
    int128 public SECONDS_IN_YEAR; // int128 for compound interest math

    // ---------------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------------

    event Deposit(address indexed account, uint256 amount);
    event Withdraw(address indexed account, uint256 amount);
    event Borrow(
        address indexed account,
        uint256 amountBorrowed,
        uint256 totalDebt,
        uint256 collateralAmount
    );
    event Repay(
        address indexed account,
        uint256 debtRepaid,
        uint256 debtRemaining,
        uint256 collateralAmount
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
        address _routerAddress,
        address[] memory _swapPath,
        uint256 _liqTotalFee,
        uint256 _liqFeeShare,
        uint256 _interestRate,
        uint256 _borrowThreshold,
        uint256 _liqThreshold
    ) {
        usdzAddress = _usdzAddress;
        xSushiAddress = _xSushiAddress;
        sushiRouterAddress = _routerAddress;

        // fees and rates use SCALING_FACTOR (default 10 000)
        liquidationFee = _liqTotalFee;
        liquidatorFeeShare = _liqFeeShare;
        interestRate = _interestRate;
        borrowThreshold = _borrowThreshold;
        liquidationThreshold = _liqThreshold;

        // building xSUSHI-USDC SushiSwap pricing path
        xSushiToUsdcPath = _swapPath;

        // set SECONDS_IN_YEAR for interest calculations
        SECONDS_IN_YEAR = ABDKMath64x64.fromUInt(31556952);
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
        positions[msg.sender].collateral += _amount;

        emit Deposit(msg.sender, _amount);
    }

    // User withdraws xSUSHI collateral if safety ratio stays > 200%
    function withdraw(uint256 _amount) public {
        uint256 startingCollateral_ = positions[msg.sender].collateral;

        require(
            startingCollateral_ >= _amount,
            "not enough collateral in account"
        );

        // TODO refactor to forward ColRat for memory
        uint256 interest_ = calcInterest(msg.sender);

        positions[msg.sender].debt += interest_;
        positions[msg.sender].lastInterest = block.timestamp;

        uint256 colRatio = getCurrentCollateralRatio(msg.sender);

        require(
            colRatio > borrowThreshold,
            "collateral ratio is <= borrow threshold"
        );

        uint256 withdrawable_ = ((colRatio -
            (borrowThreshold / SCALING_FACTOR)) / type(uint256).max) *
            startingCollateral_;

        require(
            withdrawable_ >= _amount,
            "withdraw less - collateral ratio will be unsafe"
        );

        positions[msg.sender].collateral = startingCollateral_ - _amount;

        require(
            IERC20(xSushiAddress).transfer(msg.sender, _amount),
            "withdraw transfer failed"
        );

        emit Withdraw(msg.sender, _amount);
    }

    // User mints and borrows USDZ against collateral
    function borrow(uint256 _amount) public {
        require(_amount > 0, "can't borrow 0");

        uint256 interest_ = calcInterest(msg.sender);

        // Check forward col. ratio >= safe col. ratio limit
        require(
            getForwardCollateralRatio(
                msg.sender,
                positions[msg.sender].debt + interest_ + _amount
            ) >= borrowThreshold,
            "not enough collateral to borrow that much"
        );

        // add interest and new debt to position
        positions[msg.sender].debt += (_amount + interest_);
        positions[msg.sender].lastInterest = block.timestamp;

        IUSDZ(usdzAddress).mint(msg.sender, _amount);

        emit Borrow(
            msg.sender,
            _amount,
            positions[msg.sender].debt,
            positions[msg.sender].collateral
        );
    }

    // User repays any debt in USDZ
    function repay(uint256 _amount) public {
        require(_amount > 0, "can't repay 0");

        Position storage pos = positions[msg.sender];
        pos.debt += calcInterest(msg.sender);
        pos.lastInterest = block.timestamp;

        if (pos.debt > _amount) {
            require(
                IUSDZ(usdzAddress).transferFrom(
                    msg.sender,
                    address(this),
                    _amount
                ),
                "repay transfer failed"
            );
            pos.debt -= _amount;
        } else {
            // repay all debt, as _amount >= debt
            require(
                IUSDZ(usdzAddress).transferFrom(
                    msg.sender,
                    address(this),
                    pos.debt
                ),
                "repay transfer failed"
            );
            pos.debt = 0;
        }

        emit Repay(msg.sender, _amount, pos.debt, pos.collateral);
    }

    // Liquidates account if collateral ratio below safety threshold
    function liquidate(address _account) public {
        // TODO
        // calc interest
        // calc forward Col Rat
        // if col rat < threshold: liquidate
        // split collateral across accounts
        // market sell some collateral for USDC
        // account for protocol shortfall
        emit Liquidation(_account, msg.sender, 0, 0, 0);
    }

    // ---------------------------------------------------------------------
    // PUBLIC VIEW FUNCTIONS
    // ---------------------------------------------------------------------

    function getPosition(address _account)
        public
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (
            positions[_account].collateral,
            positions[_account].debt,
            positions[_account].lastInterest
        );
    }

    // ---------------------------------------------------------------------
    // HELPER FUNCTIONS
    // ---------------------------------------------------------------------

    // Calculates forward collateral ratio of an account, using custom debt amount
    function getForwardCollateralRatio(address _account, uint256 _totalDebt)
        public
        view
        returns (uint256)
    {
        return _getCollateralRatio(_account, _totalDebt);
    }

    // Calculates current collateral ratio of an account.
    function getCurrentCollateralRatio(address _account)
        public
        view
        returns (uint256)
    {
        return _getCollateralRatio(_account, positions[_account].debt);
    }

    // Internal getColRatio logic
    // Assumes totalDebt is in USDZ, and 1 USDZ = 1 USDC, and collateral is in xSUSHI
    function _getCollateralRatio(address _account, uint256 _totalDebt)
        internal
        view
        returns (uint256)
    {
        uint256 collateral_ = positions[_account].collateral;

        if (collateral_ == 0) {
            // if collateral is 0, col ratio is 0 and no borrowing possible
            return 0;
        } else if (_totalDebt == 0) {
            // if debt is 0, col ratio is infinite
            return type(uint256).max;
        }
        IUniswapV2Router02 router = IUniswapV2Router02(sushiRouterAddress);
        uint256 collateralValue_ = router.getAmountsOut(
            collateral_,
            xSushiToUsdcPath
        )[2];

        // col. ratio = collateral USDC value / debt USDC value
        // E.g. 2:1 will return 2 000 000 (2000000/10000=200) for 200%
        return (collateralValue_ * SCALING_FACTOR * 100) / (_totalDebt);
    }

    // Calculates interest on position of given address
    // WARNING: contains fancy math
    function calcInterest(address _account)
        public
        view
        returns (uint256 interest)
    {
        if (
            positions[_account].debt == 0 ||
            positions[_account].lastInterest == 0 ||
            interestRate == 0 ||
            block.timestamp == positions[_account].lastInterest
        ) {
            return 0;
        }

        uint256 secondsSinceLastInterest_ = block.timestamp -
            positions[_account].lastInterest;
        int128 yearsBorrowed_ = ABDKMath64x64.div(
            ABDKMath64x64.fromUInt(secondsSinceLastInterest_),
            SECONDS_IN_YEAR
        );
        int128 interestRate_ = ABDKMath64x64.div(
            ABDKMath64x64.fromUInt(interestRate),
            ABDKMath64x64.fromUInt(SCALING_FACTOR)
        );
        int128 debt_ = ABDKMath64x64.fromUInt(positions[_account].debt);

        // continous compound interest = P*e^(i*t)
        // this figure includes principal + interest
        uint64 interest_ = ABDKMath64x64.toUInt(
            ABDKMath64x64.mul(
                debt_,
                ABDKMath64x64.exp(
                    ABDKMath64x64.mul(interestRate_, yearsBorrowed_)
                )
            )
        );

        // returns only the interest, not the principal
        return uint256(interest_) - positions[_account].debt;
    }

    // ---------------------------------------------------------------------
    // ONLY OWNER FUNCTIONS
    // ---------------------------------------------------------------------

    function setFeesAndRates(
        uint256 _liqTotalFee,
        uint256 _liqFeeShare,
        uint256 _interestRate
    ) external onlyOwner {
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
        external
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

    function setTokenAddresses(address _usdz, address _xsushi) external onlyOwner() {
        require(_usdz != address(0), "zero address not allowed");
        usdzAddress = _usdz;
        xSushiAddress = _xsushi;
    }

    // Sets any SushiSwap protocol contract addresses
    function setSushiAddresses(address _sushiRouter) external onlyOwner() {
        require(_sushiRouter != address(0), "zero address not allowed");
        sushiRouterAddress = _sushiRouter;
    }
}
