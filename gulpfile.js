/* Copyright 2015 RewardOps */
'use strict';

var gulp            = require('gulp'),
    jshint          = require('gulp-jshint'),
    stylish  = require('jshint-stylish'),
    mocha           = require('gulp-mocha'),
    paths           = {
      scripts: [
        'gulpfile.js',
        'index.js',
        'lib/**/*.js',
        'test/**/*.js'
      ]
    };

gulp.task('default', ['watch', 'lint', 'test']);

// Rerun the task when a file changes
gulp.task('watch', function() {
  gulp.watch(paths.scripts, ['lint', 'test']);
});

gulp.task('lint', function() {
  return gulp
    .src(paths.scripts)
      .pipe(jshint('.jshintrc'))
      .pipe(jshint.reporter(stylish));
});

gulp.task('test', function() {
  return gulp
    .src('test/*.js')
    .pipe(mocha({reporter: 'spec'}));
});

