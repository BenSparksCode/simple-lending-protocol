// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./utils/ABDKMath64x64.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUSDZ.sol";

import "hardhat/console.sol";

// TODO features
// - Liquidate function
// - add protocol treasury accounting (repay/liquidate)
// - dealing with protocol shortfall

// TODO fixes
// - add nonReentrant
// - remove fees/rates in contructor - setter only for safety
// - consider refactoring price query to sep function
// - check best practices for ABDKMath64x64
// - standardize revert msgs
// - use smaller uints for fees and rates
// - natspec comments for functions

contract Controller is Ownable {
    struct Position {
        uint256 collateral;
        uint256 debt;
        uint256 lastInterest;
    }

    mapping(address => Position) private positions;
    // to store protocol and user liquidation fees (in xSUSHI)
    mapping(address => uint256) private liquidationFees;

    // protocol debt and interest revenue in USDZ
    uint256 public protocolDebt;
    uint256 public protocolIntRev;

    address public usdcAddress;
    address public usdzAddress;
    address public xSushiAddress;
    address public sushiRouterAddress;

    address[] public xSushiToUsdcPath;

    uint256 public liqFeeProtocol;
    uint256 public liqFeeSender;

    uint256 public interestRate;

    uint256 public borrowThreshold;
    uint256 public liqThreshold;

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
        address _usdcAddress,
        address _xSushiAddress,
        address _routerAddress,
        address[] memory _swapPath,
        uint256 _liqFeeProtocol,
        uint256 _liqFeeSender,
        uint256 _interestRate,
        uint256 _borrowThreshold,
        uint256 _liqThreshold
    ) {
        usdzAddress = _usdzAddress;
        usdcAddress = _usdcAddress;
        xSushiAddress = _xSushiAddress;
        sushiRouterAddress = _routerAddress;

        // fees and rates use SCALING_FACTOR (default 10 000)
        liqFeeProtocol = _liqFeeProtocol;
        liqFeeSender = _liqFeeSender;
        interestRate = _interestRate;
        borrowThreshold = _borrowThreshold;
        liqThreshold = _liqThreshold;

        // building xSUSHI-USDC SushiSwap pricing path
        xSushiToUsdcPath = _swapPath;

        // set SECONDS_IN_YEAR for interest calculations
        SECONDS_IN_YEAR = ABDKMath64x64.fromUInt(31556952);

        // infinite approve Sushi pool for token liquidation swaps
        require(
            IERC20(xSushiAddress).approve(
                address(sushiRouterAddress),
                type(uint256).max
            ),
            "xsushi approve failed"
        );
    }

    // ---------------------------------------------------------------------
    // PUBLIC STATE-MODIFYING FUNCTIONS
    // ---------------------------------------------------------------------

    // User deposits xSUSHI as collateral
    function deposit(uint256 _amount) public {
        // IERC20 xSUSHI = IERC20(xSushiAddress);
        require(
            IERC20(xSushiAddress).transferFrom(
                msg.sender,
                address(this),
                _amount
            ),
            "deposit failed"
        );

        // Adding deposited collateral to position
        positions[msg.sender].collateral += _amount;

        emit Deposit(msg.sender, _amount);
    }

    // User withdraws xSUSHI collateral if safety ratio stays > 200%
    function withdraw(uint256 _amount) public {
        Position storage pos = positions[msg.sender];
        require(pos.collateral >= _amount, "not enough collateral in account");

        uint256 interest_ = calcInterest(msg.sender);

        pos.debt += interest_;
        pos.lastInterest = block.timestamp;

        uint256 colRatio = getCurrentCollateralRatio(msg.sender);

        require(
            colRatio > borrowThreshold,
            "account already below safety ratio"
        );

        uint256 withdrawable_;

        if (pos.debt == 0) {
            withdrawable_ = pos.collateral;
        } else {
            withdrawable_ =
                (pos.collateral / colRatio) *
                (colRatio - borrowThreshold);
        }

        require(withdrawable_ >= _amount, "amount unsafe to withdraw");

        pos.collateral -= _amount;

        require(
            IERC20(xSushiAddress).transfer(msg.sender, _amount),
            "withdraw transfer failed"
        );

        emit Withdraw(msg.sender, _amount);
    }

    // User mints and borrows USDZ against collateral
    function borrow(uint256 _amount) public {
        require(_amount > 0, "can't borrow 0");
        Position storage pos = positions[msg.sender];

        uint256 interest_ = calcInterest(msg.sender);

        // Check forward col. ratio >= safe col. ratio limit
        require(
            getForwardCollateralRatio(
                msg.sender,
                pos.debt + interest_ + _amount
            ) >= borrowThreshold,
            "not enough collateral to borrow that much"
        );

        // add interest and new debt to position
        pos.debt += (_amount + interest_);
        pos.lastInterest = block.timestamp;

        IUSDZ(usdzAddress).mint(msg.sender, _amount);

        emit Borrow(msg.sender, _amount, pos.debt, pos.collateral);
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
    function liquidate(address _account, uint256 _maxDiscount) public {
        Position storage pos = positions[_account];

        require(pos.collateral > 0, "account has no collateral");

        uint256 interest_ = calcInterest(_account);

        // Check debt + interest puts account below liquidation col ratio
        require(
            getForwardCollateralRatio(_account, pos.debt + interest_) <
                liqThreshold,
            "account not below liq threshold"
        );

        // calc fees to protocol and liquidator
        uint256 protocolShare = ((pos.collateral * liqFeeProtocol) /
            SCALING_FACTOR);
        uint256 liquidatorShare = ((pos.collateral * liqFeeSender) /
            SCALING_FACTOR);

        require(
            protocolShare + liquidatorShare <= pos.collateral,
            "liq fees incorrectly set"
        );
        require(_maxDiscount <= SCALING_FACTOR, "max discount max is 100%");

        // taking protocol fees in xSUSHI
        liquidationFees[address(this)] += protocolShare;
        // paying liquidator fees in xSUSHI
        liquidationFees[msg.sender] += liquidatorShare;

        // TODO refactor price query to separate function - use in _getCollateralRatio
        uint256 collateralValInUSDC = IUniswapV2Router02(sushiRouterAddress)
            .getAmountsOut(pos.collateral, xSushiToUsdcPath)[2];

        // sell remaining xSUSHI collateral for USDC
        IUniswapV2Router02 router = IUniswapV2Router02(sushiRouterAddress);

        // TODO use the returned amounts to calc shortfall etc
        router.swapExactTokensForTokens(
            pos.collateral - (protocolShare + liquidatorShare),
            (collateralValInUSDC * (SCALING_FACTOR - _maxDiscount)) /
                SCALING_FACTOR,
            xSushiToUsdcPath,
            address(this),
            block.timestamp
        );

        pos.collateral = 0;
        pos.debt = 0;

        // TODO account for shortfall

        emit Liquidation(_account, msg.sender, 0, 0, 0);
    }

    // ---------------------------------------------------------------------
    // SWAPPER AND CLAIM FUNCTIONS
    // ---------------------------------------------------------------------

    // Deposit USDC to mint USDZ 1:1
    function swapUSDCforUSDZ(uint256 _usdcAmount) public {
        require(_usdcAmount > 0, "can't mint zero USDZ");
        require(
            IERC20(usdcAddress).transferFrom(
                msg.sender,
                address(this),
                _usdcAmount
            ),
            "USDC transfer failed"
        );
        IUSDZ(usdzAddress).mint(msg.sender, _usdcAmount);
    }

    // Burn USDZ to withdraw USDC 1:1
    // TODO make nonReentrant
    function swapUSDZforUSDC(uint256 _usdzAmount) public {
        uint256 usdcBalance = IERC20(usdcAddress).balanceOf(address(this));
        require(usdcBalance >= _usdzAmount, "USDC reserve too low");
        IUSDZ(usdzAddress).burn(msg.sender, _usdzAmount);
        IERC20(usdcAddress).transfer(msg.sender, _usdzAmount);
    }

    function claimLiquidationFees(uint256 _amount) public {
        require(
            liquidationFees[msg.sender] >= _amount,
            "amount higher than balance"
        );

        liquidationFees[msg.sender] -= _amount;

        IERC20(xSushiAddress).transfer(msg.sender, _amount);
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
            uint256,
            uint256
        )
    {
        calcInterest(_account);
        return (
            positions[_account].collateral, // collateral
            positions[_account].debt, // debt
            calcInterest(_account), // interest
            positions[_account].lastInterest // interestCalcStartTime
        );
    }

    function getLiquidationFees(address _account)
        public
        view
        returns (uint256)
    {
        return liquidationFees[_account];
    }

    // Returns account's current col rat incl. index
    // Returns true if account is liquidatable
    function isLiquidatable(address _account)
        public
        view
        returns (uint256, bool)
    {
        uint256 colRat;
        uint256 debt;
        uint256 interest;

        (, debt, interest, ) = getPosition(_account);
        colRat = getForwardCollateralRatio(_account, debt + interest);

        return (colRat, colRat < liqThreshold);
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
    // NOTE: EXCLUDES INTEREST
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
        // E.g. 2:1 will return 20 000 (20 000/10 000=2) for 200%
        return (collateralValue_ * SCALING_FACTOR) / (_totalDebt);
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
        uint256 _liqFeeProtocol,
        uint256 _liqFeeSender,
        uint256 _interestRate
    ) external onlyOwner {
        // Liquidation fees
        require(
            _liqFeeProtocol + _liqFeeSender <= SCALING_FACTOR,
            "liq fees out of range"
        );
        liqFeeProtocol = _liqFeeProtocol;
        liqFeeSender = _liqFeeSender;

        // Interest rates - capped at 100% APR
        require(_interestRate <= SCALING_FACTOR, "interestRate out of range");
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
        liqThreshold = _liqThreshold;
    }

    function setTokenAddresses(
        address _usdz,
        address _usdc,
        address _xsushi
    ) external onlyOwner {
        require(
            _usdz != address(0) && _usdc != address(0) && _xsushi != address(0),
            "zero address not allowed"
        );
        usdzAddress = _usdz;
        usdcAddress = _usdc;
        xSushiAddress = _xsushi;
    }

    // Sets any SushiSwap protocol contract addresses
    function setSushiAddresses(address _sushiRouter) external onlyOwner {
        require(_sushiRouter != address(0), "zero address not allowed");
        sushiRouterAddress = _sushiRouter;
    }
}
