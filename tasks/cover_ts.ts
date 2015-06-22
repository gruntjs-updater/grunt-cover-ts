/*
 * grunt-cover-ts
 * https://github.com/kitsonk/grunt-cover-ts
 *
 * Copyright (c) 2015 Kitson Kelly
 * Licensed under the BSD-3-Clause license.
 */

import * as sourceMap from 'source-map';
import * as path from 'path';

const TN = /^TN:\s*(.*)$/;
const SF = /^SF:\s*(.*)$/; /* source file */
const FN = /^FN:\s*([0-9]+),(.*)$/; /* function */
const FNF = /^FNF:\s*([0-9]+)$/; /* function count */
const FNH = /^FNH:\s*([0-9]+)$/; /* function count covered */
const FNDA = /^FNDA:\s*([0-9]+),(.*)$/; /* function count accessed */
const DA = /^DA:\s*([0-9]+),([0-9]+)$/; /* line accessed */
const LF = /^LF:\s*([0-9]+)$/; /* line count */
const LH = /^LH:\s*([0-9]+)$/; /* line covered count */
const BRDA = /^BRDA:\s*([0-9]+),([0-9]+),([0-9]+),([0-9]+)$/; /* branches accessed */
const BRF = /^BRF:\s*([0-9]+)/; /* branch count */
const BRH = /^BRH:\s*([0-9]+)/; /* branch count count */
const END_OF_RECORD = /^\s*end_of_record\s*$/; /* end of record */

const sourceMapRegEx = /\/{2}#\s*sourceMappingURL\s*=\s*(\S+)/;

interface LineHash {
    [index: number]: boolean;
}

interface LcovRecordMap {
    [index: string]: LcovRecord;
}

interface MappedLcovPosition {
    line: number;
    column: number;
    name: string;
    originalLine?: number;
}

interface CoveredFunction {
    lineNumber: number;
    functionName: string;
}

interface AccessedFunction {
    count: number;
    functionName: string;
}

interface AccessedLine {
    lineNumber: number;
    count: number;
}

interface CoveredBranch {
    lineNumber: number;
    id: number;
    branch: number;
    count: number;
}

class LcovRecord {
    tn: string = '';
    sourceFile: string = '';
    functions: CoveredFunction[] = [];
    functionCount: number = 0;
    functionCoveredCount: number = 0;
    functionsAccessed: AccessedFunction[] = [];
    linesAccessed: AccessedLine[] = [];
    lineCount: number = 0;
    lineCoveredCount: number = 0;
    branchesCovered: CoveredBranch[] = [];
    branchCount: number = 0;
    branchCoveredCount: number = 0;
}

export = function(grunt: IGrunt) {

    function parseLcov(lcov: string): LcovRecord[] {

        function parseRecord(record: string[]): LcovRecord {
            let result = new LcovRecord();
            result.functions = [];
            result.functionsAccessed = [];
            result.linesAccessed = [];
            result.branchesCovered = [];
            record.forEach(function (line) {
                let execResult: RegExpExecArray;
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

        const records: any[] = [];
        let lines = lcov.match(/[^\r\n]+/g);
        let record: string[] = [];
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
    };

    function remap(lcovRecord: LcovRecord, src: string[], smc: sourceMap.SourceMapConsumer): void {
        let funcPos: MappedLcovPosition[] = [];
        let inComment: boolean = false;

        /* Find all the functions in source, does not find lambda functions */
        src.forEach(function (item: string, idx: number) {
            const reg = /function\s+([^ "'\(]+)?\s*\(/g;
            const commentStart = /\/\*/.exec(item);
            const commentEnd = /\*\//.exec(item);
            const commentLine = /\/{2}/.exec(item);
            let match: RegExpExecArray;
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

        /* Identify the mapped location for each function (and original source file) */
        let source: string;
        funcPos = funcPos.map(function (item: MappedLcovPosition): MappedLcovPosition {
            const originalPosition = smc.originalPositionFor({ line: item.line, column: item.column });
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

        /* Couldn't ensure coverage report matches original source file */
        if (funcPos.length !== lcovRecord.functions.length) {
            throw new Error('Cannot re-map functions due to lack of matching');
        }

        /* Let's map the functions to their line locations */
        lcovRecord.functions = lcovRecord.functions.map(function (item: CoveredFunction, idx: number): CoveredFunction {
            /* Currently, TypeScript packaging, while covered in code coverage cannot be mapped back.
             * so for now, just leaving the original posistion */
            if (item.lineNumber === funcPos[idx].line && funcPos[idx].originalLine) {
                item.lineNumber = funcPos[idx].originalLine;
            }
            else if (item.lineNumber !== funcPos[idx].line) {
                grunt.log.error('Emitted line numbers do not match for function: ' + item.functionName);
            }
            return item;
        });

        /* Create a line per line map between the two files */
        const lineMap: number[][] = Array(src.length + 1);
        smc.eachMapping(function (item: sourceMap.MappingItem) {
            if (!lineMap[item.generatedLine]) {
                lineMap[item.generatedLine] = [];
            }
            if (!~lineMap[item.generatedLine].indexOf(item.originalLine)) {
                lineMap[item.generatedLine].push(item.originalLine);
            }
        });

        /* Remap the lines covered */
        const mappedAccessedLines: AccessedLine[] = [];
        const lineHash: LineHash = {};
        lcovRecord.linesAccessed.forEach(function (item: AccessedLine) {
            let lines: number[];
            if (lines = lineMap[item.lineNumber]) {
                lines.forEach(function (lineNumber: number) {
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
        mappedAccessedLines.sort((a: AccessedLine, b: AccessedLine) => a.lineNumber === b.lineNumber ? 0 : a.lineNumber < b.lineNumber ? -1 : 1);
        lcovRecord.linesAccessed = mappedAccessedLines;
        lcovRecord.lineCount = mappedAccessedLines.length;
        lcovRecord.lineCoveredCount = mappedAccessedLines.reduce((previousValue: number, currentValue: AccessedLine) => previousValue + (currentValue.count ? 1 : 0), 0);

        /* Remap the branches covered */
        const branchesCovered: CoveredBranch[] = [];
        let priorId: number = 0;
        let branchId: number = 0;
        lcovRecord.branchesCovered.forEach(function (branch: CoveredBranch) {
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
        lcovRecord.branchCoveredCount = branchesCovered.reduce((previousValue: number, currentValue: CoveredBranch) => previousValue + (currentValue.count ? 1 : 0), 0);
    }

    function emitLcov(records: LcovRecord[]): string {
        let lcov: string[] = [];

        function writeRecord(record: LcovRecord): string[] {
            const result: string[] = [];
            result.push('TN:' + record.tn);
            result.push('SF:' + record.sourceFile);
            record.functions.forEach(function (item: CoveredFunction) {
                result.push('FN:' + item.lineNumber + ',' + item.functionName);
            });
            result.push('FNF:' + record.functionCount);
            result.push('FNH:' + record.functionCoveredCount);
            record.functionsAccessed.forEach(function (item: AccessedFunction) {
                result.push('FNDA:' + item.count + ',' + item.functionName);
            });
            record.linesAccessed.forEach(function (item: AccessedLine) {
                result.push('DA:' + item.lineNumber + ',' + item.count);
            });
            result.push('LF:' + record.lineCount);
            result.push('LH:' + record.lineCoveredCount);
            record.branchesCovered.forEach(function (item: CoveredBranch) {
                result.push('BRDA:' + item.lineNumber + ',' + item.id + ',' + item.branch + ',' + item.count);
            });
            result.push('BRF:' + record.branchCount);
            result.push('BRH:' + record.branchCoveredCount);
            result.push('end_of_record');
            return result;
        }

        records.forEach(function (record: LcovRecord) {
            lcov = lcov.concat(writeRecord(record));
        });

        return lcov.join('\n');
    }

    grunt.registerMultiTask('cover_ts', 'Takes line coverage information and source maps to determine coverage for TypeScript.', function() {
        const done = this.async();
        const options = this.options({});
        let parsedLcov: LcovRecord[];

        parsedLcov = parseLcov(grunt.file.read(this.filesSrc[0]));
        parsedLcov.map(item => item.sourceFile).forEach(function (sourceFileName) {
            grunt.log.writeln('Processing: ' + sourceFileName);
            const sourceFileText = grunt.file.read(sourceFileName);
            const mapFileNameMatch = sourceMapRegEx.exec(sourceFileText);
            const mapFileName = mapFileNameMatch ? path.join(path.dirname(sourceFileName), mapFileNameMatch[1]) : sourceFileName + '.map';
            const src = sourceFileText.match(/[^\r\n]+/g);
            const smc = new sourceMap.SourceMapConsumer(grunt.file.readJSON(mapFileName));
            parsedLcov.forEach(function (lcovRecord: LcovRecord) {
                if (lcovRecord.sourceFile === sourceFileName) {
                    remap(lcovRecord, src, smc);
                }
            });
        });

        grunt.file.write(this.filesSrc[0], emitLcov(parsedLcov));

        done();
    });
}
