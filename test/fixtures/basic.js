var Basic = (function () {
    function Basic(arg) {
        this._arg = arg;
    }
    Basic.prototype.emit = function () {
        return this._arg;
    };
    return Basic;
})();
var basic = new Basic('test');
exports.default = basic;
//# sourceMappingURL=basic.js.map