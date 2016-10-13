var path = require('path');

module.exports = {
    entry: {
        'dist': './src/index.js'
    },
    output: {
        path: __dirname,
        library: 'AudioEngine',
        libraryTarget: 'commonjs2',
        filename: '[name].js'
    },
    module: {
        loaders: [{
            test: /\.js$/,
            loader: 'babel-loader',
            include: path.resolve(__dirname, 'src'),
            query: {
                presets: ['es2015']
            }
        }]
    }
};
