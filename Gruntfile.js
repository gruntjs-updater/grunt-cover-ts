/*
 * grunt-cover-ts
 * https://github.com/kitsonk/grunt-cover-ts
 *
 * Copyright (c) 2015 Kitson Kelly
 * Licensed under the BSD-3-Clause license.
 */

'use strict';

function mixin(destination, source) {
    for (var key in source) {
        destination[key] = source[key];
    }
    return destination;
}

var logStack = [];
var log = function log() {
    logStack.push(arguments);
};
log.logStack = logStack;

module.exports = function(grunt) {

    var tsconfig = JSON.parse(grunt.file.read('tsconfig.json'));
    var compilerOptions = mixin({}, tsconfig.compilerOptions);

    // Project configuration.
    grunt.initConfig({

        tsconfig: tsconfig,

        devDirectory: '<%= tsconfig.compilerOptions.outDir %>',

        // Before generating any new files, remove any previously-created files.
        clean: {
            tests: ['tmp']
        },

        // Configuration to be run (and then tested).
        cover_ts: {
            basic: {
                src: 'test/fixtures/basic.lcov.info',
                dest: 'tmp/basic.lcov.info'
            },
            inline: {
                src: 'test/fixtures/inline.lcov.info',
                dest: 'tmp/inline.lcov.info'
            }
        },

        map_coverage_json: {
            basic: {
                src: 'test/fixtures/coverage-final.json',
                dest: 'tmp/coverage-final.json'
            }
        },

        map_coverage: {
            basic: {
                options: {
                    reports: {
                        'clover': 'tmp/clover.xml',
                        'cobertura': 'tmp/cobertura.xml',
                        'html': 'tmp/html-report',
                        'json-summary': 'tmp/map_coverage.coverage-summary.json',
                        'json': 'tmp/map_coverage.coverage.json',
                        'lcovonly': 'tmp/map_coverage.lcov.info',
                        'teamcity': 'tmp/teamcity.txt',
                        'text-lcov': log,
                        'text-summary': 'tmp/text-summary.txt',
                        'text': 'tmp/text.txt'
                    }
                },
                src: 'test/fixtures/coverage-final.json'
            },
            srcdest: {
                files: [
                    { src: 'text/fixtures/coverage-final.json', dest: 'tmp/srcdest.coverage.json', type: 'json' }
                ]
            }
        },

        // Unit tests.
        nodeunit: {
            tests: ['test/*_test.js']
        }

    });

    // Actually load this plugin's task(s).
    grunt.loadTasks('tasks');

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-nodeunit');

    // Whenever the "test" task is run, first clean the "tmp" dir, then run this
    // plugin's task(s), then test the result.
    grunt.registerTask('test', [ 'clean', 'nodeunit' ]);

    // By default, lint and run all tests.
    grunt.registerTask('default', [ 'test' ]);

};
