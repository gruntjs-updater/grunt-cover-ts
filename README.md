# grunt-cover-ts

Takes line coverage information and source maps to determine coverage for TypeScript.

This plugin has been designed to work with an `lcov.info` that is generated from [Istanbul](https://gotwarlost.github.io/istanbul/).  It also has only been designed to re-map source maps generated by [TypeScript](http://www.typescriptlang.org/) that are peers of the emitted JavaScript.  Because it simply walks the `lcov.info` and maps back via [Mozilla's source-map](https://github.com/mozilla/source-map/), it may work in other use cases.

## Getting Started
This plugin requires Grunt `~0.4.5`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-cover-ts --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-cover-ts');
```

## The "cover_ts" task

### Overview
In your project's Gruntfile, add a section named `cover_ts` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  cover_ts: {
    src: 'lcov.info', // location of the lcov.info to rewrite
    your_target: {
      src: 'tmp/lcov.info'  // when using a specific target, location of your lcov.info to rewrite
    }
  }
});
```

### Usage Examples

#### Basic Usage

You just need to provide a location of a `lcov.info` and it will then be analysed and rewritten by the plugin, so basic usage would look something like this:

```js
grunt.initConfig({
    cover_ts: {
        src: 'lcov.info'
    }
});
```

If you are then submitting your coverage information somewhere, just ensure that this task occurs after your coverage information is produced and before submission to the remote host.

## Release History
_(Nothing yet)_
