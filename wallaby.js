
module.exports = function () {
    return {
        files: ['**/**.js'],
        tests: ['test/**/*.js'],
        env: {
            type: 'node',
            runner: 'node   '
        },
        testFramework: 'mocha',
        workers: {
            initial: 1,
            regular: 1,
            restart: true
        }
    };
};
