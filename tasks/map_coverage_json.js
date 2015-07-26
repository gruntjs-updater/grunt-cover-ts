var sourceMap = require('source-map');
var path = require('path');
var sourceMapRegEx = /(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;
module.exports = function (grunt) {
    function loadSourceMap(fileName) {
        var sourceFileText = grunt.file.read(fileName);
        var _a = sourceMapRegEx.exec(sourceFileText), sourceMapURLMatch = _a[0], sourceMapEncoding = _a[1], sourceMapURL = _a[2];
        if (!sourceMapURLMatch) {
            grunt.fail.fatal(new Error('Cannot find source-map for "' + fileName + '"'));
        }
        var rawSourceMap;
        if (sourceMapEncoding) {
            rawSourceMap = JSON.parse((new Buffer(sourceMapURL, 'base64').toString('ascii')));
        }
        else {
            rawSourceMap = grunt.file.readJSON(path.join(path.dirname(fileName), sourceMapURL));
        }
        return new sourceMap.SourceMapConsumer(rawSourceMap);
    }
    function remap(coverage, coverageSourceMap) {
        var key;
        var lineMap = {};
        var mappedPath;
        coverageSourceMap.eachMapping(function (item) {
            if (item.generatedLine in coverage.l) {
                if (!mappedPath) {
                    mappedPath = item.source;
                }
                if (!(item.generatedLine in lineMap)) {
                    lineMap[String(item.generatedLine)] = [];
                }
                if (!~lineMap[String(item.generatedLine)].indexOf(item.originalLine)) {
                    lineMap[String(item.generatedLine)].push(item.originalLine);
                }
            }
        });
        var l = {};
        for (key in coverage.l) {
            if (key in lineMap) {
                lineMap[key].forEach(function (originalLine) {
                    l[originalLine] = l[originalLine] ? l[originalLine] + coverage.l[key] : coverage.l[key];
                });
            }
        }
        coverage.l = l;
        coverage.path = path.join(path.dirname(coverage.path), mappedPath);
        var functionItem;
        var functionArray = [];
        var functionHash = {};
        for (key in coverage.fnMap) {
            functionItem = coverage.fnMap[key];
            var startLoc = coverageSourceMap.originalPositionFor({ line: functionItem.loc.start.line, column: functionItem.loc.start.column });
            var endLoc = coverageSourceMap.originalPositionFor({ line: functionItem.loc.end.line, column: functionItem.loc.end.column });
            functionItem.loc.start = { line: startLoc.line, column: startLoc.column };
            functionItem.loc.end = { line: endLoc.line, column: endLoc.column };
            if (functionItem.loc.start.line && functionItem.loc.end.line) {
                functionItem.line = functionItem.loc.start.line;
                functionArray.push(functionItem);
                functionHash[key] = functionArray.length;
            }
            else {
                if (functionItem.loc.start.line && !functionItem.loc.end.line) {
                    grunt.fail.warn(new Error('Mapped start of function, but did not find end.\r\n' + JSON.stringify(functionItem)));
                }
                functionHash[key] = null;
            }
        }
        coverage.fnMap = {};
        functionArray.forEach(function (item, idx) {
            coverage.fnMap[idx + 1] = item;
        });
        var f = {};
        for (key in coverage.f) {
            if (functionHash[key]) {
                f[functionHash[key]] = coverage.f[key];
            }
        }
        coverage.f = f;
        var branchItem;
        var branchArray = [];
        var branchHash = {};
        for (key in coverage.branchMap) {
            branchItem = coverage.branchMap[key];
            var locations = branchItem.locations.map(function (loc, idx) {
                var startLoc = coverageSourceMap.originalPositionFor(loc.start);
                var endLoc = coverageSourceMap.originalPositionFor(loc.end);
                loc.start = { line: startLoc.line, column: startLoc.column };
                loc.end = { line: endLoc.line, column: endLoc.column };
                if (loc.start.line && loc.end.line) {
                    return loc;
                }
            });
            branchItem.locations = locations.filter(function (item) {
                return Boolean(item);
            });
            if (branchItem.locations.length) {
                branchItem.line = branchItem.locations[0].start.line;
                branchArray.push(branchItem);
                branchHash[key] = branchArray.length;
            }
            else {
                branchHash[key] = null;
            }
        }
        coverage.branchMap = {};
        branchArray.forEach(function (item, idx) {
            coverage.branchMap[idx + 1] = item;
        });
        var b = {};
        for (key in coverage.b) {
            if (branchHash[key]) {
                b[branchHash[key]] = coverage.b[key];
            }
        }
        coverage.b = b;
        var statementArray = [];
        var statementHash = {};
        for (key in coverage.statementMap) {
            var item = coverage.statementMap[key];
            var startLoc = coverageSourceMap.originalPositionFor(item.start);
            var endLoc = coverageSourceMap.originalPositionFor(item.end);
            item.start = { line: startLoc.line, column: startLoc.column };
            item.end = { line: endLoc.line, column: endLoc.column };
            if (item.start.line && item.end.line) {
                statementArray.push(item);
                statementHash[key] = statementArray.length;
            }
            else {
                statementHash[key] = null;
            }
        }
        coverage.statementMap = {};
        statementArray.forEach(function (item, idx) {
            coverage.statementMap[String(idx + 1)] = item;
        });
        var s = {};
        for (key in coverage.s) {
            if (statementHash[key]) {
                s[statementHash[key]] = coverage.s[key];
            }
        }
        coverage.s = s;
        if ('sourceMappingUrl' in coverage) {
            delete coverage.sourceMappingUrl;
        }
        return coverage;
    }
    grunt.registerMultiTask('map_coverage_json', 'Takes line coverage information and source maps to determine coverage for TypeScript.', function () {
        var done = this.async();
        var options = this.options({});
        this.files.forEach(function (file) {
            var destContent = {};
            file.src.forEach(function (fileName) {
                var coverage = grunt.file.readJSON(fileName);
                var targetCoverage = {};
                for (var key in coverage) {
                    var item = coverage[key];
                    var itemSourceMap = loadSourceMap(item.path);
                    var mappedItem = remap(item, itemSourceMap);
                    targetCoverage[mappedItem.path] = mappedItem;
                }
                if (file.dest) {
                    for (var key in targetCoverage) {
                        destContent[key] = targetCoverage[key];
                    }
                }
                else {
                    grunt.file.write(fileName, JSON.stringify(coverage));
                }
            });
            if (file.dest) {
                grunt.file.write(file.dest, JSON.stringify(destContent));
            }
        });
        done();
    });
};
//# sourceMappingURL=map_coverage_json.js.map