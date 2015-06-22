
class Basic {
    private _arg: string;
    constructor (arg: string) {
        this._arg = arg;
    }
    emit(): string {
        return this._arg;
    }
}

var basic = new Basic('test');

if (basic && basic.emit()) {
    console.log('foo');
}
else {
    console.log('bar');
}

export default basic;
