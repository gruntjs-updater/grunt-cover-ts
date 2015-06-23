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
