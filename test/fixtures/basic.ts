
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

export default basic;
