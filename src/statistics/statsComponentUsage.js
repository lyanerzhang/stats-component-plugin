const fs = require("fs")
const path = require("path")
const chalk = require("chalk")
const { parse } = require("@vue/compiler-sfc")
const { objArrSort } = require("../utils/index")

const scanVuePages = (statsObj, options, module) => {
  const realpath = fs.realpathSync(module.resource)
  if (realpath.includes(options.parentPath)) {
    const relativePath = path.relative(process.cwd(), module.userRequest)
    statsObj.fileComponentUsage[relativePath] = {}
    statisticVueFileComponentUsage(statsObj, options, relativePath, module)
  }
}

const statsComCount = (statsObj, componentName, relativePath) => {
  statsObj.componentUsage[componentName] = (statsObj.componentUsage[componentName] || 0) + 1
  statsObj.fileComponentUsage[relativePath][componentName] =
    (statsObj.fileComponentUsage[relativePath][componentName] || 0) + 1
}

const statisticVueFileComponentUsage = (statsObj, options, relativePath, module) => {
  const source = fs.readFileSync(module.userRequest, "utf-8")
  // 尝试使用@vue/compiler-sfc解析.vue文件
  const { descriptor } = parse(source)
  let templateContent = descriptor && descriptor.template && descriptor.template.content
  let scriptContent = descriptor && descriptor.script && descriptor.script.content
  let temMatch, funMatch
  while ((temMatch = options.temRegex.exec(templateContent)) !== null) {
    const componentName = temMatch[1]
    statsComCount(statsObj, componentName, relativePath)
  }
  while ((funMatch = options.funRegex.exec(scriptContent)) !== null) {
    const componentName = funMatch[1]
    statsComCount(statsObj, componentName, relativePath)
  }
}
const outputComUsage = (statsObj, options) => {
  let fileUsageCount = 0
  for (let key in statsObj.fileComponentUsage) {
    for (let comKey in statsObj.fileComponentUsage[key]) {
      if (options.comNames.length && !options.comNames.includes(comKey)) {
        delete statsObj.fileComponentUsage[key][comKey]
      }
    }
    if (Object.keys(statsObj.fileComponentUsage[key]).length) {
      fileUsageCount++
    }
  }
  statsObj.totalPages = Object.keys(statsObj.fileComponentUsage).length
  statsObj.coverageRate = ((fileUsageCount / statsObj.totalPages) * 100).toFixed(2) + "%"
  statsObj.componentUsage = objArrSort(statsObj.componentUsage)
  console.log(
    `\n${chalk.blue(options.name)}页面使用覆盖率：${chalk.green(statsObj.coverageRate)}`
  )
  // 统计各个组件使用情况
  if (options.isStatsComUsage) {
    Object.keys(statsObj.componentUsage).forEach(key => {
      const value = statsObj.componentUsage[key]
      const per =
        Number((value / Object.keys(statsObj.componentUsage).length).toPrecision(3)) * 100
      console.log(
        `\n${chalk.blue(key)} 组件引用次数 ${chalk.green(value)} 引用率 ${chalk.redBright(
          per
        )}%`
      )
    })
  }
}
exports.scanVuePages = scanVuePages
exports.outputComUsage = outputComUsage