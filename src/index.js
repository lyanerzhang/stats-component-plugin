const fs = require("fs")
const path = require("path")
const webpack = require("webpack")
const NormalModule = webpack.NormalModule
const { scanVuePages, outputComUsage } = require("./statistics/statsComponentUsage")
// const server = require('./server/index')
const EnhancedStatsPlugin = require('./statistics/enhancedStatsPlugin')

const initStatsMetric = function () {
  return {
    componentUsage: {}, // 统计每个组件使用情况
    fileComponentUsage: {}, // 统计每个文件组件使用情况
    totalPages: 0, // 页面总数
    coverageRate: 0 // 页面覆盖率
  }
}
function getDirectoryTree(startPath) {
  let result = { name: path.basename(startPath), children: [] };
  let files = fs.readdirSync(startPath);

  files.forEach(file => {
    let filePath = path.join(startPath, file);
    let stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
        result.children.push(getDirectoryTree(filePath));
    } else {
        result.children.push({ name: file });
    }
  });
  return result
}
function waitSrcTree(srcpath){
  return new Promise((resolve) => {
    const srcTree = getDirectoryTree(srcpath)
    resolve(srcTree)
  })
}
class StatsComponentPlugin {
  constructor(options) {
    const defaultOptions = {
      name: "chuxin-ui-mobile", // 组件库名称
      temRegex: /<(cx-[a-z-0-9]+)/g, // 模板匹配
      funRegex: /(CX.*)\(/g, // 函数匹配
      parentPath: "/src/views", // 统计页面所在目录
      fileTypes: "vue", // 统计文件类型
      comNames: [], // 组件名统计白名单
      isStatsComUsage: false
    }
    this.options = Object.assign({}, defaultOptions, options)
    this.stats = initStatsMetric()
    this.id = 0
  }
  switchCaseFile(module) {
    if (this.id === 0) {
      const { fileTypes } = this.options
      if (module.resource.indexOf("node_modules") !== -1) {
        return false
      }
      switch (fileTypes) {
        case "vue":
          if (/\.vue$/.test(module.resource)) {
            scanVuePages(this.stats, this.options, module)
          }
          break;
      }
    }
  }

  apply(compiler) {
    compiler.hooks.compilation.tap("StatsComponentPlugin", compilation => {
      if (
        NormalModule &&
        NormalModule.getCompilationHooks &&
        compilation instanceof webpack.Compilation
      ) {
        // Webpack 5
        NormalModule.getCompilationHooks(compilation).loader.tap(
          "StatsComponentPlugin",
          (loaderContext, module) => {
            this.switchCaseFile(module)
          }
        )
      } else {
        // Webpack 4
        compilation.hooks.normalModuleLoader.tap(
          "StatsComponentPlugin",
          (loaderContext, module) => {
            this.switchCaseFile(module)
          }
        )
      }
    })
    compiler.hooks.done.tap("StatsComponentPlugin", stats => {
      this.id === 0 && waitSrcTree(path.join(compiler.context, 'src')).then(srcTree => {
        this.id++
        outputComUsage(this.stats, this.options)
      })
    })
  }
}

module.exports = StatsComponentPlugin
module.exports.EnhancedStatsPlugin = EnhancedStatsPlugin


