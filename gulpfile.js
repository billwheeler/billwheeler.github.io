const gulp = require('gulp')
const gutil = require('gulp-util')
const babel = require('gulp-babel')
const babelify = require('babelify')
const browserify = require('browserify')
const source = require('vinyl-source-stream')

gulp.task('default', () => {
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