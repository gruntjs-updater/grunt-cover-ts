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

exports.map_coverage = {
    setUp: function (done) {
        // setup here if necessary
        done();
    },
    basic: function (test) {
        test.expect(6);

        runGruntTask('map_coverage:basic', function () {
            [ 'map_coverage.coverage-summary.json', 'map_coverage.coverage.json',
                'map_coverage.lcov.info', 'teamcity.txt', 'text-summary.txt', 'text.txt' ].
                forEach(function (filename) {
                    var expected = grunt.file.read('test/expected/' + filename);
                    var results = grunt.file.read('tmp/' + filename);
                    test.equal(expected, results, 'coverage file "' + filename + '" should match');
                });
            test.done();
        });
        /* TODO - Validate the remaining files produced including the console log */
    },
    srcdest: function (test) {
        test.expect(1);

        runGruntTask('map_coverage:srcdest', function () {
            var expected = grunt.file.read('test/expected/srcdest.coverage.json');
            var results = grunt.file.read('tmp/srcdest.coverage.json');
            test.equal(expected, results, 'coverage file should match');
            test.done();
        });
    }
};
