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
if (basic && basic.emit()) {
    console.log('foo');
}
else {
    console.log('bar');
}
exports.default = basic;
//# sourceMappingURL=basic.js.map