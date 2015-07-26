import * as sourceMap from 'source-map';
import * as path from 'path';

interface IstanbulLocation {
    start: { line: number, column: number };
    end: { line: number, column: number };
    skip?: boolean;
}

interface IstanbulFunctionMapValue {
    name: string;
    line: number;
    loc: IstanbulLocation;
    skip?: boolean;
}

interface IstanbulBranchMapValue {
    line: number;
    type: string;
    locations: IstanbulLocation[];
}

interface IstanbulFileCoverage {
    path: string;
    s: { [StatementId: string]: number };
    b: { [BranchId: string]: number[] };
    f: { [FunctionId: string]: number };
    fnMap: { [FunctionId: string]: IstanbulFunctionMapValue };
    statementMap: { [StatementId: string]: IstanbulLocation };
    branchMap: { [BranchId: string]: IstanbulBranchMapValue };
    sourceMappingUrl?: string;
    l: { [LineId: string]: number };
}

interface IstanbulCoverage {
    [Path: string]: IstanbulFileCoverage;
}

/* identifies a sourceMap comment, including detecting if it is a inline source map */
const sourceMapRegEx = /(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;

export = function(grunt: IGrunt) {

    function loadSourceMap(fileName: string): sourceMap.SourceMapConsumer {
        const sourceFileText = grunt.file.read(fileName);
        const [ sourceMapURLMatch, sourceMapEncoding, sourceMapURL ] = sourceMapRegEx.exec(sourceFileText);
        if (!sourceMapURLMatch) {
            grunt.fail.fatal(new Error('Cannot find source-map for "' + fileName + '"'));
        }
        let rawSourceMap: sourceMap.RawSourceMap;
        if (sourceMapEncoding) {
            rawSourceMap = JSON.parse((new Buffer(sourceMapURL, 'base64').toString('ascii')));
        }
        else {
            rawSourceMap = grunt.file.readJSON(path.join(path.dirname(fileName), sourceMapURL));
        }
        return new sourceMap.SourceMapConsumer(rawSourceMap);
    }

    /**
     * Remaps a coverage object using a source map
     * @param coverage The coverage object that needs to be remapped
     * @param coverageSourceMap The source map to use to remap the coverage object
     * @returns The remapped coverage file
     */
    function remap(coverage: IstanbulFileCoverage, coverageSourceMap: sourceMap.SourceMapConsumer): IstanbulFileCoverage {
        let key: string;

        /* remap coverage.l */
        const lineMap: { [lineNo: string]: number[] } = {};
        let mappedPath: string;
        /* since source maps do contain just line mappings, we have to make an
         * educated guess about the line numbers.  We basically make a hash of
         * the lines, drop out any that don't map in the original file and then
         * combine the coverage counts where the generate line comes from more
         * than one source line */
        coverageSourceMap.eachMapping(function (item: sourceMap.MappingItem) {
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
        const l: { [lineNo: string]: number } = {};
        for (key in coverage.l) {
            if (key in lineMap) {
                lineMap[key].forEach(function (originalLine) {
                    l[originalLine] = l[originalLine] ? l[originalLine] + coverage.l[key] : coverage.l[key];
                });
            }
        }
        coverage.l = l;
        coverage.path = path.join(path.dirname(coverage.path), mappedPath);

        /* remap coverage.f and coverage.fnMap */
        let functionItem: IstanbulFunctionMapValue;
        const functionArray: IstanbulFunctionMapValue[] = [];
        const functionHash: { [OriginalFunctionID: string]: number } = {};
        for (key in coverage.fnMap) {
            functionItem = coverage.fnMap[key];
            let startLoc = coverageSourceMap.originalPositionFor({ line: functionItem.loc.start.line, column: functionItem.loc.start.column });
            let endLoc = coverageSourceMap.originalPositionFor({ line: functionItem.loc.end.line, column: functionItem.loc.end.column });
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
        let f: { [FunctionId: string]: number } = {};
        for (key in coverage.f) {
            if (functionHash[key]) {
                f[functionHash[key]] = coverage.f[key];
            }
        }
        coverage.f = f;

        /* remap coverage.branchMap and coverage.b */
        let branchItem: IstanbulBranchMapValue;
        const branchArray: IstanbulBranchMapValue[] = [];
        const branchHash: { [OriginalBranchId: string]: number } = {};
        for (key in coverage.branchMap) {
            branchItem = coverage.branchMap[key];
            let locations = branchItem.locations.map(function (loc, idx) {
                const startLoc = coverageSourceMap.originalPositionFor(loc.start);
                const endLoc = coverageSourceMap.originalPositionFor(loc.end);
                loc.start = { line: startLoc.line, column: startLoc.column };
                loc.end = { line: endLoc.line, column: endLoc.column };
                if (loc.start.line && loc.end.line) {
                    return loc;
                }
            });
            branchItem.locations = locations.filter(function (item): boolean {
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
        let b: { [BranchId: string]: number[] } = {};
        for (key in coverage.b) {
            if (branchHash[key]) {
                b[branchHash[key]] = coverage.b[key];
            }
        }
        coverage.b = b;

        /* remap coverage.statementMap and coverage.s */
        const statementArray: IstanbulLocation[] = [];
        const statementHash: { [OriginalStatementID: string]: number } = {};
        for (key in coverage.statementMap) {
            const item: IstanbulLocation = coverage.statementMap[key];
            const startLoc = coverageSourceMap.originalPositionFor(item.start);
            const endLoc = coverageSourceMap.originalPositionFor(item.end);
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
        let s: { [StatementId: string]: number } = {};
        for (key in coverage.s) {
            if (statementHash[key]) {
                s[statementHash[key]] = coverage.s[key];
            }
        }
        coverage.s = s;

        /* remove the sourceMappingUrl (since we just remapped) */
        if ('sourceMappingUrl' in coverage) {
            delete coverage.sourceMappingUrl;
        }

        return coverage;
    }

    grunt.registerMultiTask('map_coverage_json', 'Takes line coverage information and source maps to determine coverage for TypeScript.', function () {
        const done = this.async();
        const options = this.options({});
        this.files.forEach(function (file: grunt.file.IFilesConfig) {
            let destContent: any = {};
            file.src.forEach(function (fileName: string) {
                const coverage: IstanbulCoverage = grunt.file.readJSON(fileName);
                const targetCoverage: IstanbulCoverage = {};
                for (let key in coverage) {
                    const item = coverage[key];
                    const itemSourceMap = loadSourceMap(item.path);
                    const mappedItem = remap(item, itemSourceMap);
                    targetCoverage[mappedItem.path] = mappedItem;
                }
                if (file.dest) {
                    for (let key in targetCoverage) {
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
}
