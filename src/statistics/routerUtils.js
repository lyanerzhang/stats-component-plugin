const fs = require('fs');
const path = require('path');

/**
 * 从 router 文件中提取所有页面路径
 */
function extractPagesFromRouter(routerContent) {
  const pages = new Set();
  
  // 匹配 component: () => import("...")
  const regex = /component:\s*\(\)\s*=>\s*import\(["']([^"']+)["']\)/g;
  let match;
  
  while ((match = regex.exec(routerContent)) !== null) {
    let pagePath = match[1];
    
    // 处理路径别名
    if (pagePath.startsWith('@/views/')) {
      pagePath = pagePath.replace('@/views/', 'src/views/');
    } else if (pagePath.startsWith('@views/')) {
      pagePath = pagePath.replace('@views/', 'src/views/');
    }
    
    // 确保是 .vue 文件
    if (pagePath.endsWith('.vue')) {
      // 标准化路径
      pagePath = pagePath.replace(/\\/g, '/');
      // 转换为绝对路径用于匹配
      const absolutePath = path.resolve(process.cwd(), pagePath);
      pages.add(absolutePath);
      // 同时保存相对路径
    //   pages.add(pagePath);
    }
  }
  
  return pages;
}

/**
 * 标准化文件路径用于匹配
 */
function normalizePath(filePath) {
  // 转换为绝对路径
  const absolutePath = path.resolve(filePath);
  // 转换为相对路径（从项目根目录）
  const relativePath = path.relative(process.cwd(), absolutePath);
  return {
    absolute: absolutePath,
    relative: relativePath.replace(/\\/g, '/')
  };
}

/**
 * 检查文件是否是真实页面
 */
function isRealPage(filePath, realPages) {
  const normalized = normalizePath(filePath);
  
  // 检查是否在真实页面列表中
  return realPages.has(normalized.absolute) || 
         realPages.has(normalized.relative) ||
         Array.from(realPages).some(page => {
           const pageNormalized = normalizePath(page);
           return normalized.relative === pageNormalized.relative ||
                  normalized.relative.endsWith(pageNormalized.relative) ||
                  pageNormalized.relative.endsWith(normalized.relative);
         });
}

/**
 * 递归获取所有真实页面文件
 */
function getRealPageFiles(realPages) {
  const realPageFiles = [];
  
  realPages.forEach(pagePath => {
    const normalized = normalizePath(pagePath);
    const filePath = normalized.absolute;
    
    if (fs.existsSync(filePath)) {
      realPageFiles.push(filePath);
    } else {
      // 尝试相对路径
      const relativePath = path.join(process.cwd(), normalized.relative);
      if (fs.existsSync(relativePath)) {
        realPageFiles.push(relativePath);
      }
    }
  });
  
  return realPageFiles;
}

module.exports = {
  extractPagesFromRouter,
  normalizePath,
  isRealPage,
  getRealPageFiles
};

