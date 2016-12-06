var path = require('path');

module.exports = [
    {
        entry: {
            'audio': './src/index.js'
        },
        output: {
            path: __dirname,
            library: 'AudioEngine',
            libraryTarget: 'var',
            filename: '[name].js'
        }
    },
    {
        entry: {
            'audio': './src/index.js'
        },
        output: {
            path: __dirname,
            library: 'AudioEngine',
            libraryTarget: 'commonjs2',
            filename: '[name].commonjs.js'
        }
    }
];
