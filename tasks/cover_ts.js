/*
 * grunt-cover-ts
 * https://github.com/kitsonk/grunt-cover-ts
 *
 * Copyright (c) 2015 Kitson Kelly
 * Licensed under the BSD-3-Clause license.
 */
var sourceMap = require('source-map');
var path = require('path');
var TN = /^TN:\s*(.*)$/;
var SF = /^SF:\s*(.*)$/;
var FN = /^FN:\s*([0-9]+),(.*)$/;
var FNF = /^FNF:\s*([0-9]+)$/;
var FNH = /^FNH:\s*([0-9]+)$/;
var FNDA = /^FNDA:\s*([0-9]+),(.*)$/;
var DA = /^DA:\s*([0-9]+),([0-9]+)$/;
var LF = /^LF:\s*([0-9]+)$/;
var LH = /^LH:\s*([0-9]+)$/;
var BRDA = /^BRDA:\s*([0-9]+),([0-9]+),([0-9]+),([0-9]+)$/;
var BRF = /^BRF:\s*([0-9]+)/;
var BRH = /^BRH:\s*([0-9]+)/;
var END_OF_RECORD = /^\s*end_of_record\s*$/;
var sourceMapRegEx = /(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;
var LcovRecord = (function () {
    function LcovRecord() {
        this.tn = '';
        this.sourceFile = '';
        this.functions = [];
        this.functionCount = 0;
        this.functionCoveredCount = 0;
        this.functionsAccessed = [];
        this.linesAccessed = [];
        this.lineCount = 0;
        this.lineCoveredCount = 0;
        this.branchesCovered = [];
        this.branchCount = 0;
        this.branchCoveredCount = 0;
    }
    return LcovRecord;
})();
module.exports = function (grunt) {
    function parseLcov(lcov) {
        function parseRecord(record) {
            var result = new LcovRecord();
            result.functions = [];
            result.functionsAccessed = [];
            result.linesAccessed = [];
            result.branchesCovered = [];
            record.forEach(function (line) {
                var execResult;
                if (execResult = TN.exec(line)) {
                    result.tn = execResult[1];
                }
                else if (execResult = SF.exec(line)) {
                    result.sourceFile = execResult[1];
                }
                else if (execResult = FN.exec(line)) {
                    result.functions.push({
                        lineNumber: Number(execResult[1]),
                        functionName: execResult[2]
                    });
                }
                else if (execResult = FNF.exec(line)) {
                    result.functionCount = Number(execResult[1]);
                }
                else if (execResult = FNH.exec(line)) {
                    result.functionCoveredCount = Number(execResult[1]);
                }
                else if (execResult = FNDA.exec(line)) {
                    result.functionsAccessed.push({
                        count: Number(execResult[1]),
                        functionName: execResult[2]
                    });
                }
                else if (execResult = DA.exec(line)) {
                    result.linesAccessed.push({
                        lineNumber: Number(execResult[1]),
                        count: Number(execResult[2])
                    });
                }
                else if (execResult = LF.exec(line)) {
                    result.lineCount = Number(execResult[1]);
                }
                else if (execResult = LH.exec(line)) {
                    result.lineCoveredCount = Number(execResult[1]);
                }
                else if (execResult = BRDA.exec(line)) {
                    result.branchesCovered.push({
                        lineNumber: Number(execResult[1]),
                        id: Number(execResult[2]),
                        branch: Number(execResult[3]),
                        count: Number(execResult[4])
                    });
                }
                else if (execResult = BRF.exec(line)) {
                    result.branchCount = Number(execResult[1]);
                }
                else if (execResult = BRH.exec(line)) {
                    result.branchCoveredCount = Number(execResult[1]);
                }
            });
            return result;
        }
        var records = [];
        var lines = lcov.match(/[^\r\n]+/g);
        var record = [];
        lines.forEach(function (line) {
            if (line.match(END_OF_RECORD)) {
                records.push(parseRecord(record));
                record = [];
            }
            else {
                record.push(line);
            }
        });
        return records;
    }
    ;
    function remap(lcovRecord, src, smc) {
        var funcPos = [];
        var inComment = false;
        src.forEach(function (item, idx) {
            var reg = /function\s+([^ "'\(]+)?\s*\(/g;
            var commentStart = /\/\*/.exec(item);
            var commentEnd = /\*\//.exec(item);
            var commentLine = /\/{2}/.exec(item);
            var match;
            while (match = reg.exec(item)) {
                if (commentLine && commentLine.index < match.index) {
                    continue;
                }
                if (inComment && (!commentEnd || (commentEnd && match.index < commentEnd.index))) {
                    continue;
                }
                if (commentStart && commentStart.index < match.index) {
                    if (!commentEnd || (commentEnd && commentEnd.index > match.index)) {
                        continue;
                    }
                }
                funcPos.push({
                    line: idx + 1,
                    column: match.index + match[0].length + 1,
                    name: match[1]
                });
            }
            if (inComment && commentEnd && !commentStart) {
                inComment = false;
            }
            if (commentStart && !commentEnd) {
                inComment = true;
            }
        });
        var source;
        funcPos = funcPos.map(function (item) {
            var originalPosition = smc.originalPositionFor({ line: item.line, column: item.column });
            if (originalPosition.source) {
                if (!source) {
                    source = originalPosition.source;
                }
                else if (source !== originalPosition.source) {
                    throw new Error('Mapping between difference source files not supported: "' + source + '" and "' + originalPosition.source + '"');
                }
            }
            item.originalLine = originalPosition.line;
            return item;
        });
        lcovRecord.sourceFile = source.replace('../../', '');
        if (funcPos.length !== lcovRecord.functions.length) {
            throw new Error('Cannot re-map functions due to lack of matching');
        }
        lcovRecord.functions = lcovRecord.functions.map(function (item, idx) {
            if (item.lineNumber === funcPos[idx].line && funcPos[idx].originalLine) {
                item.lineNumber = funcPos[idx].originalLine;
            }
            else if (item.lineNumber !== funcPos[idx].line) {
                grunt.log.error('Emitted line numbers do not match for function: ' + item.functionName);
            }
            return item;
        });
        var lineMap = Array(src.length + 1);
        smc.eachMapping(function (item) {
            if (!lineMap[item.generatedLine]) {
                lineMap[item.generatedLine] = [];
            }
            if (!~lineMap[item.generatedLine].indexOf(item.originalLine)) {
                lineMap[item.generatedLine].push(item.originalLine);
            }
        });
        var mappedAccessedLines = [];
        var lineHash = {};
        lcovRecord.linesAccessed.forEach(function (item) {
            var lines;
            if (lines = lineMap[item.lineNumber]) {
                lines.forEach(function (lineNumber) {
                    if (!(lineNumber in lineHash)) {
                        lineHash[lineNumber] = true;
                        mappedAccessedLines.push({
                            lineNumber: lineNumber,
                            count: item.count
                        });
                    }
                });
            }
        });
        mappedAccessedLines.sort(function (a, b) { return a.lineNumber === b.lineNumber ? 0 : a.lineNumber < b.lineNumber ? -1 : 1; });
        lcovRecord.linesAccessed = mappedAccessedLines;
        lcovRecord.lineCount = mappedAccessedLines.length;
        lcovRecord.lineCoveredCount = mappedAccessedLines.reduce(function (previousValue, currentValue) { return previousValue + (currentValue.count ? 1 : 0); }, 0);
        var branchesCovered = [];
        var priorId = 0;
        var branchId = 0;
        lcovRecord.branchesCovered.forEach(function (branch) {
            if (lineMap[branch.lineNumber]) {
                if (priorId !== branch.id) {
                    priorId = branch.id;
                    branchId++;
                }
                branchesCovered.push({
                    lineNumber: lineMap[branch.lineNumber][0],
                    id: branchId,
                    branch: branch.branch,
                    count: branch.count
                });
            }
        });
        lcovRecord.branchesCovered = branchesCovered;
        lcovRecord.branchCount = branchesCovered.length;
        lcovRecord.branchCoveredCount = branchesCovered.reduce(function (previousValue, currentValue) { return previousValue + (currentValue.count ? 1 : 0); }, 0);
    }
    function emitLcov(records) {
        var lcov = [];
        function writeRecord(record) {
            var result = [];
            result.push('TN:' + record.tn);
            result.push('SF:' + record.sourceFile);
            record.functions.forEach(function (item) {
                result.push('FN:' + item.lineNumber + ',' + item.functionName);
            });
            result.push('FNF:' + record.functionCount);
            result.push('FNH:' + record.functionCoveredCount);
            record.functionsAccessed.forEach(function (item) {
                result.push('FNDA:' + item.count + ',' + item.functionName);
            });
            record.linesAccessed.forEach(function (item) {
                result.push('DA:' + item.lineNumber + ',' + item.count);
            });
            result.push('LF:' + record.lineCount);
            result.push('LH:' + record.lineCoveredCount);
            record.branchesCovered.forEach(function (item) {
                result.push('BRDA:' + item.lineNumber + ',' + item.id + ',' + item.branch + ',' + item.count);
            });
            result.push('BRF:' + record.branchCount);
            result.push('BRH:' + record.branchCoveredCount);
            result.push('end_of_record');
            return result;
        }
        records.forEach(function (record) {
            lcov = lcov.concat(writeRecord(record));
        });
        return lcov.join('\n');
    }
    grunt.registerMultiTask('cover_ts', 'Takes line coverage information and source maps to determine coverage for TypeScript.', function () {
        var done = this.async();
        var options = this.options({});
        this.files.forEach(function (file) {
            var destContent = '';
            file.src.forEach(function (fileName) {
                var parsedLcov = parseLcov(grunt.file.read(fileName));
                parsedLcov.map(function (item) { return item.sourceFile; }).forEach(function (sourceFileName) {
                    grunt.log.writeln('Processing: ' + sourceFileName);
                    var sourceFileText = grunt.file.read(sourceFileName);
                    var src = sourceFileText.match(/[^\r\n]+/g);
                    var sourceMappingURL = sourceMapRegEx.exec(sourceFileText);
                    var sourceMapContent;
                    if (sourceMappingURL && sourceMappingURL[1]) {
                        var buffer = new Buffer(sourceMappingURL[2], 'base64');
                        sourceMapContent = JSON.parse(buffer.toString('ascii'));
                    }
                    else if (sourceMappingURL) {
                        sourceMapContent = grunt.file.readJSON(path.join(path.dirname(sourceFileName), sourceMappingURL[2]));
                    }
                    else {
                        sourceMapContent = grunt.file.readJSON(sourceFileName + '.map');
                    }
                    var smc = new sourceMap.SourceMapConsumer(sourceMapContent);
                    parsedLcov.forEach(function (lcovRecord) {
                        if (lcovRecord.sourceFile === sourceFileName) {
                            remap(lcovRecord, src, smc);
                        }
                    });
                });
                var content = emitLcov(parsedLcov);
                if (file.dest) {
                    destContent += content;
                }
                else {
                    grunt.file.write(fileName, content);
                }
            });
            if (file.dest) {
                grunt.file.write(file.dest, destContent);
            }
        });
        done();
    });
};
//# sourceMappingURL=cover_ts.js.map