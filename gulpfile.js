var gulp = require("gulp");
var gutil = require("gulp-util");
var source = require("vinyl-source-stream");
var buffer = require("vinyl-buffer");
var browserify = require("browserify");
var sourcemaps = require("gulp-sourcemaps");
var uglify = require("gulp-uglify");

var init = function (entry, debug) {
    return browserify({
        standalone: "App",
        entries: entry,
        debug: debug || true
    });
};

var bundler = function (b) {
    return b.bundle()
        .pipe(source("scripts.js"))
        .pipe(buffer())
        .pipe(sourcemaps.init({
            loadMaps: true
        }))
        .pipe(uglify({
            compress: false
        }))
        .on("error", gutil.log)
        .pipe(sourcemaps.write("./"))
        .pipe(gulp.dest("./js"));
};

gulp.task("default", function () {
    return bundler(init("./src/main.js", true));
});