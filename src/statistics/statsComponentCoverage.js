#!/usr/bin/env node

/**
 * 基于真实页面数量统计 chuxin-ui-mobile 组件使用覆盖率
 * 使用方法: node scripts/stats-component-coverage.js
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('@vue/compiler-sfc');
const { extractPagesFromRouter, normalizePath, isRealPage, getRealPageFiles } = require('./routerUtils');

// 配置
const ROUTER_PATH = path.join(__dirname, '../src/router/index.ts');
// 配置 - 默认 router 路径，可通过命令行参数覆盖
const DEFAULT_ROUTER_PATH = path.join(process.cwd(), 'src/router/index.ts');
const VIEWS_PATH = path.join(process.cwd(), 'src/views');

// 尝试获取组件名称列表
let CxComNames = [];
// try {
//   const chuxinUiMobile = require('chuxin-ui-mobile');
//   CxComNames = chuxinUiMobile.CxComNames || [];
// } catch (error) {
//   console.warn('⚠️  无法加载 chuxin-ui-mobile，将统计所有 cx- 开头的组件');
// }

/**
 * 解析 import 语句，提取组件路径
 */
function extractComponentImports(scriptContent, fileDir) {
  const imports = [];
  
  // 匹配 import 语句中的 .vue 文件
  // 支持多种格式：
  // - import Component from './component.vue'
  // - import { Component } from './component.vue'
  // - import Component from '@/components/component.vue'
  // - import Component from '@components/component.vue'
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\w+)\s+from\s+)?["']([^"']+\.vue)["']/g;
  let match;
  
  while ((match = importRegex.exec(scriptContent)) !== null) {
    let importPath = match[1];
    
    // 处理路径别名
    if (importPath.startsWith('@/')) {
      importPath = importPath.replace('@/', 'src/');
    } else if (importPath.startsWith('@components/')) {
      importPath = importPath.replace('@components/', 'src/components/');
    } else if (importPath.startsWith('@views/')) {
      importPath = importPath.replace('@views/', 'src/views/');
    } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // 相对路径，需要基于当前文件目录解析
      importPath = path.resolve(fileDir, importPath);
      importPath = path.relative(process.cwd(), importPath);
    }
    
    // 确保是 .vue 文件
    if (importPath.endsWith('.vue')) {
      const absolutePath = path.resolve(process.cwd(), importPath);
      if (fs.existsSync(absolutePath)) {
        imports.push(absolutePath);
      }
    }
  } 
  return imports;
}
/**
 * 扫描 Vue 文件中的组件使用情况
 */
function scanComponentUsageRecursive(filePath, comNames, scannedFiles = new Set()) {
  // 防止循环引用
  if (scannedFiles.has(filePath)) {
    return {};
  }
  scannedFiles.add(filePath);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { descriptor } = parse(content);
    
    const componentUsage = {};
    
    // 扫描 template 中的组件使用
    if (descriptor.template && descriptor.template.content) {
      const templateContent = descriptor.template.content;
      
      // 匹配 <cx-xxx> 格式的组件
      const temRegex = /<(cx-[a-z-0-9]+)/g;
      let match;
      
      while ((match = temRegex.exec(templateContent)) !== null) {
        const componentName = match[1];
        if (!comNames.length || comNames.includes(componentName)) {
          componentUsage[componentName] = (componentUsage[componentName] || 0) + 1;
        }
      }
    }
    
    // 扫描 script 中的组件使用（函数调用）
    const scriptContent = descriptor.script?.content || descriptor.scriptSetup?.content || '';
    const funRegex = /(CX[A-Z][a-zA-Z]*|Cx[A-Z][a-zA-Z]*)\(/g;
    let funMatch;
    
    while ((funMatch = funRegex.exec(scriptContent)) !== null) {
      const componentName = funMatch[1];
      // 检查是否是组件名（需要根据实际情况调整）
      if (!comNames.length || comNames.includes(componentName)) {
        componentUsage[componentName] = (componentUsage[componentName] || 0) + 1;
      }
    }
    // 递归扫描导入的子组件
    const fileDir = path.dirname(filePath);
    const componentImports = extractComponentImports(scriptContent, fileDir);
    
    componentImports.forEach(componentPath => {
      const childUsage = scanComponentUsageRecursive(componentPath, comNames, scannedFiles);
      // 合并子组件的组件使用情况
      Object.keys(childUsage).forEach(componentName => {
        componentUsage[componentName] = (componentUsage[componentName] || 0) + childUsage[componentName];
      });
    });
    
    return componentUsage;
  } catch (error) {
    console.warn(`扫描文件失败 ${filePath}:`, error.message);
    return {};
  }
}
/**
 * 扫描 Vue 文件中的组件使用情况（不递归，保持向后兼容）
 */
function scanComponentUsage(filePath, comNames) {
  return scanComponentUsageRecursive(filePath, comNames);
}

/**
 * 主函数
 */
function main(options) {
  console.log('='.repeat(80));
  console.log('📊 基于真实页面的 chuxin-ui-mobile 组件使用覆盖率统计');
  console.log('='.repeat(80));
  console.log();
  
  // 1. 读取 router 文件
  const routerPath = options.routerPath;
  CxComNames = options.comNames;
  console.log("routerPath*************", routerPath)
  if (!fs.existsSync(routerPath)) {
    console.error(`❌ 错误：找不到 router 文件: ${routerPath}`);
    console.log(`💡 提示：可以通过参数指定 router 文件路径`);
    console.log(`   例如: node scripts/stats-component-coverage.js /path/to/router/index.ts`);
    process.exit(1);
  }
  
  const routerContent = fs.readFileSync(routerPath, 'utf-8');
  const realPages = extractPagesFromRouter(routerContent);
  
  console.log(`✅ 已解析 Router，找到 ${realPages.size} 个真实页面`);
  console.log();
  
  // 2. 获取所有真实页面文件
  const realPageFiles = getRealPageFiles(realPages);
  console.log(`📁 找到 ${realPageFiles.length} 个真实页面文件`);
  console.log();
  
  // 3. 扫描每个真实页面的组件使用情况
  const stats = {
    componentUsage: {}, // 组件总使用次数
    fileComponentUsage: {}, // 每个文件的组件使用情况
    totalPages: realPageFiles.length,
    pagesWithComponents: 0,
    pagesWithoutComponents: 0
  };
  
  console.log('🔍 正在扫描组件使用情况...');
  console.log();
  
  realPageFiles.forEach((filePath, index) => {
    const normalized = normalizePath(filePath);
    const relativePath = normalized.relative;
    
    const componentUsage = scanComponentUsage(filePath, CxComNames);
    stats.fileComponentUsage[relativePath] = componentUsage;
    
    // 累加组件使用次数
    Object.keys(componentUsage).forEach(componentName => {
      stats.componentUsage[componentName] = 
        (stats.componentUsage[componentName] || 0) + componentUsage[componentName];
    });
    
    // 统计使用/未使用组件的页面
    if (Object.keys(componentUsage).length > 0) {
      stats.pagesWithComponents++;
    } else {
      stats.pagesWithoutComponents++;
    }
    
    // 显示进度
    if ((index + 1) % 10 === 0 || index === realPageFiles.length - 1) {
      process.stdout.write(`\r   进度: ${index + 1}/${realPageFiles.length}`);
    }
  });
  
  console.log();
  console.log();
  
  // 4. 计算覆盖率
  const coverageRate = stats.totalPages > 0 
    ? ((stats.pagesWithComponents / stats.totalPages) * 100).toFixed(2) + '%'
    : '0%';
  
  // 5. 输出统计结果
  console.log('📈 统计结果：');
  console.log('-'.repeat(80));
  console.log(`   真实页面总数：${stats.totalPages} 个`);
  console.log(`   使用组件的页面：${stats.pagesWithComponents} 个`);
  console.log(`   未使用组件的页面：${stats.pagesWithoutComponents} 个`);
  console.log(`   页面组件使用覆盖率：${coverageRate}`);
  console.log();
  
  // 6. 组件使用统计
  if (CxComNames && CxComNames.length > 0) {
    console.log('🔧 chuxin-ui-mobile 组件使用情况：');
    console.log('-'.repeat(80));
    
    const usedComponents = [];
    const unusedComponents = [];
    
    // 按使用次数排序
    const sortedComponents = Object.entries(stats.componentUsage)
      .sort(([, a], [, b]) => b - a);
    
    if (sortedComponents.length > 0) {
      sortedComponents.forEach(([componentName, count]) => {
        usedComponents.push(componentName);
        console.log(`   ✓ ${componentName.padEnd(40)} 使用次数: ${count}`);
      });
    }
    
    // 找出未使用的组件
    CxComNames.forEach(componentName => {
      if (!usedComponents.includes(componentName)) {
        unusedComponents.push(componentName);
      }
    });
    
    console.log();
    console.log(`   已使用组件：${usedComponents.length} 个`);
    console.log(`   未使用组件：${unusedComponents.length} 个`);
    console.log(`   组件使用率：${((usedComponents.length / CxComNames.length) * 100).toFixed(2)}%`);
    
    if (unusedComponents.length > 0) {
      console.log();
      console.log('⚠️  未使用的组件列表：');
      unusedComponents.forEach(componentName => {
        console.log(`   - ${componentName}`);
      });
    }
    console.log();
  }
  
  // 7. 每个页面的组件使用详情
  console.log('📄 真实页面组件使用详情：');
  console.log('-'.repeat(80));
  
  const pagesWithComponents = Object.entries(stats.fileComponentUsage)
    .filter(([, components]) => Object.keys(components).length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  
  if (pagesWithComponents.length > 0) {
    pagesWithComponents.forEach(([filePath, components], index) => {
      const componentList = Object.keys(components).join(', ');
      const totalCount = Object.values(components).reduce((sum, count) => sum + count, 0);
      console.log(`${(index + 1).toString().padStart(3)}. ${filePath}`);
      console.log(`     组件: ${componentList} (共 ${totalCount} 次使用)`);
    });
    console.log();
  }
  
  // 8. 未使用组件的页面
  const pagesWithoutComponents = Object.keys(stats.fileComponentUsage)
    .filter(filePath => Object.keys(stats.fileComponentUsage[filePath]).length === 0);
  
  if (pagesWithoutComponents.length > 0) {
    console.log(`⚠️  未使用组件的页面（${pagesWithoutComponents.length} 个）：`);
    pagesWithoutComponents.slice(0, 20).forEach((filePath, index) => {
      console.log(`   ${(index + 1).toString().padStart(3)}. ${filePath}`);
    });
    if (pagesWithoutComponents.length > 20) {
      console.log(`   ... 还有 ${pagesWithoutComponents.length - 20} 个页面`);
    }
    console.log();
  }
  
  console.log('='.repeat(80));
  console.log();
  
  // 返回结果
  return {
    totalPages: stats.totalPages,
    pagesWithComponents: stats.pagesWithComponents,
    pagesWithoutComponents: stats.pagesWithoutComponents,
    coverageRate: parseFloat(coverageRate),
    componentUsage: stats.componentUsage,
    fileComponentUsage: stats.fileComponentUsage
  };
}

// 执行
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }
}

module.exports = { main, scanComponentUsage };