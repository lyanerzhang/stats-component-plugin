const path = require('path');

module.exports = {
  entry: './src/index.js', // 插件源文件的路径
  output: {
    path: path.resolve(__dirname, 'dist'), // 输出目录
    filename: 'index.js', // 输出文件名
    library: 'stats-component-plugin', // 指定库的名字，这样在其他地方可以通过这个名字来使用这个插件
    libraryTarget: 'umd', // 指定库的类型，umd表示这个库可以用各种方式引入，包括AMD, CommonJS, 和全局变量
  },
  mode: 'production',
  target: 'node',
  optimization: {
    minimize: true, // 禁用代码压缩
  },
  externals: {
    'webpack': 'commonjs webpack', // 插件依赖vue-template-compiler，所以将其设置为外部依赖
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader', // 使用babel-loader来转译JavaScript代码
        }
      }
    ],
    unknownContextCritical: false
  },
  resolve: {
    extensions: ['.js', '.ts','.tsx'],
  }
};