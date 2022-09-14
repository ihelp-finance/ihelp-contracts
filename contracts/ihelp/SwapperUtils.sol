// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

library SwapperUtils {
   
    function toScale(uint256 _fromScale, uint256 _toScale, uint256 _amount) external pure  returns (uint256) {
        if (_fromScale < _toScale) {
            _amount = _amount * safepow(10, _toScale - _fromScale);
        } else if (_fromScale > _toScale) {
            _amount = _amount / safepow(10, _fromScale - _toScale);
        }
        return _amount;
    }

    function safepow(uint256 base, uint256 exponent) public pure returns (uint256) {
        if (exponent == 0) {
            return 1;
        } else if (exponent == 1) {
            return base;
        } else if (base == 0 && exponent != 0) {
            return 0;
        } else {
            uint256 z = base;
            for (uint256 i = 1; i < exponent; i++) z = z * base;
            return z;
        }
    }
}
