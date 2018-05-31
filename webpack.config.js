var path = require('path');

module.exports = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: 'cheap-module-source-map',
    entry: {
        dist: './src/index.js'
    },
    output: {
        path: __dirname,
        library: 'AudioEngine',
        libraryTarget: 'commonjs2',
        filename: '[name].js'
    },
    module: {
        rules: [{
            test: /\.js$/,
            include: path.resolve(__dirname, 'src'),
            loader: 'babel-loader',
            options: {
                presets: [['env', {targets: {browsers: ['last 3 versions', 'Safari >= 8', 'iOS >= 8']}}]]
            }
        }]
    },
    externals: {
        'audio-context': true,
        'minilog': true,
        'startaudiocontext': true
    }
};
