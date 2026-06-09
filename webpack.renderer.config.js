const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';
  return {
    entry: './src/renderer/index.tsx',
    target: 'web',
    output: {
      path: path.resolve(__dirname, 'dist/renderer'),
      filename: 'bundle.js',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: { configFile: 'tsconfig.renderer.json' },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
      }),
    ],
    devServer: {
      port: 9000,
      hot: true,
      static: { directory: path.join(__dirname, 'dist/renderer') },
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
    devtool: isDev ? 'eval-source-map' : 'source-map',
  };
};
