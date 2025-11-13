/**
 * 增强版组件统计插件
 * 基于 router 的真实页面数量统计 chuxin-ui-mobile 组件使用覆盖率
 */
const fs = require('fs');
const path = require('path');
const { extractPagesFromRouter, normalizePath, isRealPage } = require('./routerUtils');
const { main: statsComponentCoverage } = require("./statsComponentCoverage.js")

class EnhancedStatsPlugin {
  constructor(options = {}) {
    this.options = {
      routerPath: options.routerPath || path.join(process.cwd(), 'src/router/index.ts'),
      viewsPath: options.viewsPath || path.join(process.cwd(), 'src/views'),
      comNames: options.comNames || [],
      ...options
    };
    this.realPages = new Set();
  }
  /**
   * 过滤统计结果，只保留真实页面
   */
  filterRealPages(stats) {
    if (!stats || !stats.fileComponentUsage) {
      return stats;
    }
    const filteredStats = {
      componentUsage: { ...stats.componentUsage },
      fileComponentUsage: {},
      totalPages: 0,
      realPages: 0,
      coverageRate: 0
    };
    // 重新计算组件使用情况（只统计真实页面）
    const realPageComponentUsage = {};
    let realPagesWithComponents = 0;
    for (const filePath in stats.fileComponentUsage) {
      if (this.isRealPage(filePath)) {
        filteredStats.fileComponentUsage[filePath] = stats.fileComponentUsage[filePath];
        filteredStats.realPages++;
        // 统计真实页面中的组件使用
        const hasComponent = Object.keys(stats.fileComponentUsage[filePath]).length > 0;
        if (hasComponent) {
          realPagesWithComponents++;
        }
        // 累加组件使用次数
        for (const componentName in stats.fileComponentUsage[filePath]) {
          if (!this.options.comNames.length || this.options.comNames.includes(componentName)) {
            realPageComponentUsage[componentName] = 
              (realPageComponentUsage[componentName] || 0) + 
              stats.fileComponentUsage[filePath][componentName];
          }
        }
      }
    }
    filteredStats.componentUsage = realPageComponentUsage;
    filteredStats.totalPages = this.realPages.size;
    filteredStats.coverageRate = filteredStats.totalPages > 0 
      ? ((realPagesWithComponents / filteredStats.totalPages) * 100).toFixed(2) + '%'
      : '0%';
    return filteredStats;
  }
  /**
   * 检查文件是否是真实页面
   */
  isRealPage(filePath) {
    return isRealPage(filePath, this.realPages);
  }
  /**
   * 输出增强的统计报告
   */
  outputEnhancedStats(filteredStats, originalStats) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 基于真实页面的组件使用统计（Enhanced Stats）');
    console.log('='.repeat(80));
    console.log();

    // 基本信息
    console.log('📈 页面统计：');
    console.log(`   真实页面总数（基于 Router）：${filteredStats.totalPages} 个`);
    console.log(`   使用组件的真实页面：${filteredStats.realPages} 个`);
    console.log(`   页面组件使用覆盖率：${filteredStats.coverageRate}`);
    console.log();
    // 对比原始统计
    if (originalStats && originalStats.totalPages) {
      console.log('📊 对比原始统计：');
      console.log(`   原始统计页面数：${originalStats.totalPages} 个`);
      console.log(`   真实页面数：${filteredStats.totalPages} 个`);
      console.log(`   差异：${originalStats.totalPages - filteredStats.totalPages} 个（非页面文件）`);
      console.log();
    }
    // 组件使用统计
    if (this.options.comNames && this.options.comNames.length > 0) {
      console.log('🔧 chuxin-ui-mobile 组件使用情况：');
      console.log('-'.repeat(80));
      const usedComponents = [];
      const unusedComponents = [];
      // 按使用次数排序
      const sortedComponents = Object.entries(filteredStats.componentUsage)
        .sort(([, a], [, b]) => b - a);
      sortedComponents.forEach(([componentName, count]) => {
        usedComponents.push(componentName);
        console.log(`   ✓ ${componentName.padEnd(40)} 使用次数: ${count}`);
      });
      // 找出未使用的组件
      this.options.comNames.forEach(componentName => {
        if (!usedComponents.includes(componentName)) {
          unusedComponents.push(componentName);
        }
      });
      console.log();
      console.log(`   已使用组件：${usedComponents.length} 个`);
      console.log(`   未使用组件：${unusedComponents.length} 个`);
      
      if (unusedComponents.length > 0) {
        console.log();
        console.log('⚠️  未使用的组件列表：');
        unusedComponents.forEach(componentName => {
          console.log(`   - ${componentName}`);
        });
      }
      console.log();
    }
    // 每个真实页面的组件使用情况
    console.log('📄 真实页面组件使用详情：');
    console.log('-'.repeat(80));
    
    const pagesWithComponents = Object.entries(filteredStats.fileComponentUsage)
      .filter(([, components]) => Object.keys(components).length > 0)
      .sort(([a], [b]) => a.localeCompare(b));
    pagesWithComponents.forEach(([filePath, components], index) => {
      const componentList = Object.keys(components).join(', ');
      console.log(`${(index + 1).toString().padStart(3)}. ${filePath}`);
      console.log(`     组件: ${componentList}`);
    });
    const pagesWithoutComponents = Object.keys(filteredStats.fileComponentUsage)
      .filter(filePath => Object.keys(filteredStats.fileComponentUsage[filePath]).length === 0);
    if (pagesWithoutComponents.length > 0) {
      console.log();
      console.log(`⚠️  未使用组件的页面（${pagesWithoutComponents.length} 个）：`);
      pagesWithoutComponents.slice(0, 10).forEach(filePath => {
        console.log(`   - ${filePath}`);
      });
      if (pagesWithoutComponents.length > 10) {
        console.log(`   ... 还有 ${pagesWithoutComponents.length - 10} 个页面`);
      }
    }
    console.log();
    console.log('='.repeat(80));
    console.log();
  }
  apply(compiler) {
    // 在编译开始前，解析 router 文件获取真实页面列表
    compiler.hooks.beforeCompile.tapAsync('EnhancedStatsPlugin', (params, callback) => {
      try {
        if (fs.existsSync(this.options.routerPath)) {
          const routerContent = fs.readFileSync(this.options.routerPath, 'utf-8');
          const pages = extractPagesFromRouter(routerContent);
          this.realPages = pages;
          console.log(`\n[EnhancedStatsPlugin] 已解析 Router，找到 ${pages.size} 个真实页面\n`);
        } else {
          console.warn(`[EnhancedStatsPlugin] 警告：找不到 router 文件 ${this.options.routerPath}`);
        }
      } catch (error) {
        console.error(`[EnhancedStatsPlugin] 解析 router 文件失败:`, error);
      }
      callback();
    });
    // 在编译完成后，处理统计结果
    compiler.hooks.done.tapAsync('EnhancedStatsPlugin', (stats, callback) => {
      try {
        // 尝试从 stats-component-plugin 获取统计结果
        // 由于 stats-component-plugin 可能将结果存储在全局变量或文件中
        // 这里我们需要通过其他方式获取，或者直接重新统计
        
        // 方案：读取 stats-component-plugin 的输出，或者通过编译统计获取
        // 由于插件是压缩的，我们采用另一种方式：在 done 钩子中重新分析
        
        // 这里我们输出提示信息，实际统计需要结合 stats-component-plugin 的输出
        console.log('\n[EnhancedStatsPlugin] 编译完成，准备生成增强统计报告...\n');
        
        // 注意：实际的组件使用统计需要从 stats-component-plugin 获取
        // 或者我们需要在 compilation 阶段拦截统计
        statsComponentCoverage(this.options)
        
      } catch (error) {
        console.error(`[EnhancedStatsPlugin] 处理统计结果失败:`, error);
      }
      callback();
    });
  }
}
module.exports = EnhancedStatsPlugin;
  