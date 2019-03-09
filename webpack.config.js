const path = require('path');
const NodeExternals = require('webpack-node-externals');
const CleanPlugin = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const TSDeclarationPlugin = require('ts-declaration-webpack-plugin');
const RemoveFilesPlugin = require('remove-files-webpack-plugin');
const ReplaceInFilePlugin = require('replace-in-file-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  output: {
    filename: 'index.js',
    libraryTarget: 'commonjs2'
  },
  target: 'node',
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  externals: [NodeExternals()],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    // Clean dist directory before compilation
    new CleanPlugin(),
    // Bundle declaration files into one
    new TSDeclarationPlugin({
      name: 'index.d.ts'
    }),
    // Remove declaration files that were bundled with TSDeclarationPlugin
    new RemoveFilesPlugin({
      after: {
        root: path.resolve('.'),
        test: [
          {
            folder: 'dist',
            method(filePath) {
              return /\.d\.ts$/.test(filePath);
            }
          }
        ],
        exclude: ['dist/index.d.ts']
      }
    }),
    // Apply workarounds for mistakes in declaration file output
    new ReplaceInFilePlugin([
      {
        dir: 'dist',
        files: ['index.d.ts'],
        rules: [
          // Workaround for @types dependency <reference> directives automatically being added to declaration files
          {
            search: /^\/\/\/.+\s+^/gm,
            replace: ''
          },
          // Workaround for default imports being output as named imports in declaration files
          {
            search: /(?<=import ){ (\w+),/g,
            replace: '$1, {'
          }
        ]
      }
    ])
  ],
  optimization: {
    minimizer: [
      new TerserPlugin({
        cache: true,
        parallel: true,
        terserOptions: {
          warnings: false,
          ecma: 6
        }
      })
    ]
  }
};
