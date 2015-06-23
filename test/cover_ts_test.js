'use strict';

var grunt = require('grunt');

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

function runGruntTask(taskName, callback) {
    var task = grunt.task._taskPlusArgs(taskName);
    task.task.fn.apply({
        nameArgs: task.nameArgs,
        name: task.task.name,
        args: task.args,
        flags: task.flags,
        async: function() { return callback; }
    }, task.args);
}

exports.cover_ts = {
    setUp: function (done) {
        // setup here if necessary
        done();
    },
    basic: function (test) {
        test.expect(1);

        runGruntTask('cover_ts:basic', function () {
            var expected = grunt.file.read('test/expected/basic.lcov.info');
            var results = grunt.file.read('tmp/basic.lcov.info');
            test.equal(expected, results, 'line coverage file remapped');
            test.done();
        });
    },
    inline: function (test) {
        test.expect(1);

        runGruntTask('cover_ts:inline', function () {
            var expected = grunt.file.read('test/expected/inline.lcov.info');
            var results = grunt.file.read('tmp/inline.lcov.info');
            test.equal(expected, results, 'line coverage file remapped');
            test.done();
        });
    }
};
