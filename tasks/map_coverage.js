/* jshint node:true */
/* global WeakMap */

require('istanbul/index');
var Collector = require('istanbul/lib/collector');
var path = require('path');
var SMC = require('source-map').SourceMapConsumer;
var sourceMapRegEx = /(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;

var istanbulReportTypes = {
    'clover': 'file',
    'cobertura': 'file',
    'html': 'directory',
    'json-summary': 'file',
    'json': 'file',
    'lcovonly': 'file',
    'teamcity': 'file',
    'text-lcov': 'console',
    'text-summary': 'file',
    'text': 'file'
};

var metaInfo = new WeakMap();
function getSourceCoverage(srcCoverage, filename) {
    var data = srcCoverage[filename];
    if (!data) {
        data = srcCoverage[filename] = {
            path: filename,
            statementMap: {},
            fnMap: {},
            branchMap: {},
            s: {},
            b: {},
            f: {}
        };
        metaInfo.set(data, {
            indexes: {},
            lastIndex: {
                s: 0,
                b: 0,
                f: 0
            }
        });
    }

    return {
        data: data,
        meta: metaInfo.get(data)
    };
}

function getMapping(sourceMap, sourceMapDir, location) {
    var start = sourceMap.originalPositionFor(location.start);
    var end = sourceMap.originalPositionFor(location.end);
    var src;

    if (!start || !end) {
        return null;
    }
    if (!start.source || !end.source || start.source !== end.source) {
        return null;
    }
    if (start.line === null || start.column === null) {
        return null;
    }
    if (end.line === null || end.column === null) {
        return null;
    }
    src = start.source;

    if (start.line === end.line && start.column === end.column) {
        end = sourceMap.originalPositionFor({
            line: location.end.line,
            column: location.end.column,
            bias: 2
        });
        end.column = end.column - 1;
    }

    return {
        source: path.join(sourceMapDir, start.source),
        loc: {
            start: {
                line: start.line,
                column: start.column
            },
            end: {
                line: end.line,
                column: end.column
            }
        }
    };
}

module.exports = function (grunt) {
    grunt.registerMultiTask('map_coverage', function () {
        var done = this.async();
        var options = this.options() || {};

        this.files.forEach(function (file) {
            var collector = new Collector();
            file.src.forEach(function (file) {
                collector.add(grunt.file.readJSON(file));
            });

            var coverage = collector.getFinalCoverage();
            var srcCoverage = {};

            Object.keys(coverage).forEach(function (filePath) {
                var fileCoverage = coverage[filePath];
                var jsText = grunt.file.read(filePath);
                var match = sourceMapRegEx.exec(jsText);
                var sourceMapDir = path.dirname(filePath);
                var rawSourceMap;

                if (!match) {
                    grunt.fail.warn(new Error('Could not find source map for: "' + filePath + '"'));
                    return;
                }

                if (match[1]) {
                    rawSourceMap = JSON.parse((new Buffer(match[2], 'base64').toString('ascii')));
                }
                else {
                    var sourceMapPath = path.join(sourceMapDir, match[2]);
                    rawSourceMap = grunt.file.readJSON(sourceMapPath);
                    sourceMapDir = path.dirname(sourceMapPath);
                }

                var sourceMap = new SMC(rawSourceMap);
                Object.keys(fileCoverage.fnMap).forEach(function (index) {
                    var genItem = fileCoverage.fnMap[index];
                    var mapping = getMapping(sourceMap, sourceMapDir, genItem.loc);

                    if (!mapping) {
                        return;
                    }

                    var hits = fileCoverage.f[index];
                    var covInfo = getSourceCoverage(srcCoverage, mapping.source);
                    var data = covInfo.data;
                    var meta = covInfo.meta;
                    var srcItem = {
                        name: genItem.name,
                        line: mapping.loc.start.line,
                        loc: mapping.loc
                    };
                    var key = [
                        'f',
                        srcItem.loc.start.line, srcItem.loc.start.column,
                        srcItem.loc.end.line, srcItem.loc.end.column
                    ].join(':');

                    var fnIndex = meta.indexes[key];
                    if (fnIndex == null) {
                        fnIndex = ++meta.lastIndex.f;
                        meta.indexes[key] = fnIndex;
                        data.fnMap[fnIndex] = srcItem;
                    }
                    data.f[fnIndex] = data.f[fnIndex] || 0;
                    data.f[fnIndex] += hits;
                });

                Object.keys(fileCoverage.statementMap).forEach(function (index) {
                    var genItem = fileCoverage.statementMap[index];
                    var mapping = getMapping(sourceMap, sourceMapDir, genItem);

                    if (!mapping) {
                        return;
                    }

                    var hits = fileCoverage.s[index];
                    var covInfo = getSourceCoverage(srcCoverage, mapping.source);
                    var data = covInfo.data;
                    var meta = covInfo.meta;

                    var key = [
                        's',
                        mapping.loc.start.line, mapping.loc.start.column,
                        mapping.loc.end.line, mapping.loc.end.column
                    ].join(':');

                    var stIndex = meta.indexes[key];
                    if (stIndex == null) {
                        stIndex = ++meta.lastIndex.s;
                        meta.indexes[key] = stIndex;
                        data.statementMap[stIndex] = mapping.loc;
                    }
                    data.s[stIndex] = data.s[stIndex] || 0;
                    data.s[stIndex] += hits;
                });

                Object.keys(fileCoverage.branchMap).forEach(function (index) {
                    var genItem = fileCoverage.branchMap[index];
                    var locations = [];
                    var source;
                    var key = [ 'b' ];

                    for (var i = 0; i < genItem.locations.length; ++i) {
                        var mapping = getMapping(sourceMap, sourceMapDir, genItem.locations[i]);
                        if (!mapping) {
                            return;
                        }
                        if (!source) {
                            source = mapping.source;
                        }
                        else if (source !== mapping.source) {
                            return;
                        }
                        locations.push(mapping.loc);
                        key.push(
                            mapping.loc.start.line, mapping.loc.start.column,
                            mapping.loc.end.line, mapping.loc.end.line
                        );
                    }

                    key = key.join(':');

                    var hits = fileCoverage.b[index];
                    var covInfo = getSourceCoverage(srcCoverage, source);
                    var data = covInfo.data;
                    var meta = covInfo.meta;

                    var brIndex = meta.indexes[key];
                    if (brIndex == null) {
                        brIndex = ++meta.lastIndex.b;
                        meta.indexes[key] = brIndex;
                        data.branchMap[brIndex] = {
                            line: locations[0].start.line,
                            type: genItem.type,
                            locations: locations
                        };
                    }

                    if (!data.b[brIndex]) {
                        data.b[brIndex] = locations.map(function () {
                            return 0;
                        });
                    }

                    for (i = 0; i < hits.length; ++i) {
                        data.b[brIndex][i] += hits[i];
                    }
                });
            });

            collector = new Collector();
            collector.add(srcCoverage);

            // generate line counts
            collector.getFinalCoverage();

            function outputReport(reportType, dest) {
                if (!(reportType in istanbulReportTypes)) {
                    grunt.fail.warm(new SyntaxError('Istanbul report type not recognised: "' + reportType + '"'));
                    return;
                }
                var Reporter = require('istanbul/lib/report/' + reportType);
                var options = {};
                switch (istanbulReportTypes[reportType]) {
                case 'file':
                    options.file = dest;
                    break;
                case 'directory':
                    options.dir = dest;
                    break;
                case 'console':
                    options.log = dest || grunt.log.writeln;
                    break;
                }
                var reporter = new Reporter(options);
                reporter.writeReport(collector, true);
            }

            if (file.type && file.dest) {
                outputReport(file.type, file.dest);
            }
            else {
                for (var key in options.reports) {
                    outputReport(key, options.reports[key]);
                }
            }
        });
        done();
    });
};
