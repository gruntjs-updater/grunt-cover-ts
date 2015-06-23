class Inline {
    constructor (data: string = '') {
        this.data = data;
    }
    data: string = '';
}

var inline = new Inline();

function main() {
    inline.data = true ? '' : 'foo';
}

main();
