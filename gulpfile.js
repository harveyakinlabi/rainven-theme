const gulp = require('gulp');
const path = require('path');

const themeDestination = process.env.GHOST_THEME_DEST || path.join(
    process.env.HOME,
    'ghost-local/content/themes/rainven-theme'
);

function copyTheme() {
    return gulp.src([
        '**/*',
        '!**/.DS_Store',
        '!node_modules/**',
        '!*.zip',
        '!gulpfile.js',
        '!package-lock.json'
    ])
    .pipe(gulp.dest(themeDestination));
}

function watchFiles() {
    gulp.watch([
        '**/*.hbs',
        'assets/css/**/*.css',
        'assets/js/**/*.js',
        'package.json'
    ], copyTheme);
}

exports.default = gulp.series(copyTheme, watchFiles);
exports.copy = copyTheme;
exports.watch = gulp.series(copyTheme, watchFiles);
