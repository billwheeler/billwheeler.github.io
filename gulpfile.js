const gulp = require('gulp')
const gutil = require('gulp-util')
const babel = require('gulp-babel')
const babelify = require('babelify')
const browserify = require('browserify')
const source = require('vinyl-source-stream')
const buffer = require('vinyl-buffer')
const uglify = require('gulp-uglify')


gulp.task('releasejs', () => {
    browserify({
        standalone: 'App',
        entries: './src/main.js',
        debug: false
    })
    .transform(babelify, {
        presets: ['@babel/preset-env']
    })
    .on('error', gutil.log)
    .bundle()
    .on('error', gutil.log)
    .pipe(source('scripts.js'))
    .pipe(buffer()) 
    .pipe(uglify()) 
    .pipe(gulp.dest('js'))
})


gulp.task('debugjs', () => {
    browserify({
        standalone: 'App',
        entries: './src/main.js',
        debug: true
    })
    .transform(babelify, {
        presets: ['@babel/preset-env']
    })
    .on('error', gutil.log)
    .bundle()
    .on('error', gutil.log)
    .pipe(source('scripts.js'))
    .pipe(gulp.dest('js'))
})

gulp.task('default', ['debugjs'])