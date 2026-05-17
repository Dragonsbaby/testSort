#!/usr/bin/env node

/**
 * 测试工具脚本
 * 提供便捷的测试运行命令
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_CATEGORIES = {
  unit: 'test/unit',
  integration: 'test/integration',
  component: 'test/components',
  e2e: 'test/e2e',
  all: 'test'
};

const COMMANDS = {
  test: 'vitest',
  'test:ui': 'vitest --ui',
  'test:coverage': 'vitest --coverage',
  'test:run': 'vitest run',
  'test:e2e': 'playwright test',
  'test:e2e:ui': 'playwright test --ui',
  'test:e2e:debug': 'playwright test --debug',
  'test:watch': 'vitest --watch'
};

function runCommand(command, description) {
  console.log(`\n🚀 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} 完成`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} 失败:`, error.message);
    return false;
  }
}

function runTestsByCategory(category, filter = '') {
  const testDir = TEST_CATEGORIES[category];
  if (!testDir) {
    console.error(`❌ 未知的测试类别: ${category}`);
    process.exit(1);
  }

  const filterFlag = filter ? ` --grep="${filter}"` : '';
  const command = `vitest run ${testDir}${filterFlag}`;
  return runCommand(command, `运行 ${category} 测试${filter ? ' (过滤: ' + filter + ')' : ''}`);
}

function generateCoverageReport() {
  console.log('\n📊 生成覆盖率报告...');
  runCommand('npm run test:coverage', '运行测试并生成覆盖率');

  const coverageDir = path.join(process.cwd(), 'coverage');
  const lcovFile = path.join(coverageDir, 'lcov.info');

  if (fs.existsSync(lcovFile)) {
    console.log('\n📈 覆盖率报告已生成:');
    console.log(`   - HTML: ${path.join(coverageDir, 'index.html')}`);
    console.log(`   - LCOV: ${lcovFile}`);

    // 读取并显示覆盖率摘要
    try {
      const summary = execSync('npx coverage-summary-cli coverage/lcov.info', { encoding: 'utf8' });
      console.log('\n📊 覆盖率摘要:');
      console.log(summary);
    } catch (error) {
      console.log('   (无法显示详细摘要，请查看HTML报告)');
    }
  }
}

function runE2ETests(browser = 'all') {
  const browserFlag = browser !== 'all' ? ` --project=${browser}` : '';
  const command = `playwright test${browserFlag}`;
  return runCommand(command, `运行 E2E 测试${browser !== 'all' ? ' (' + browser + ')' : ''}`);
}

function runQuickTests() {
  console.log('\n⚡ 运行快速测试 (跳过 E2E)...');
  return runCommand('vitest run', '运行单元测试和集成测试');
}

function runFullTestSuite() {
  console.log('\n🎯 运行完整测试套件...');

  const results = {
    unit: runCommand('vitest run test/unit', '单元测试'),
    integration: runCommand('vitest run test/integration', '集成测试'),
    e2e: runCommand('playwright test', 'E2E 测试')
  };

  console.log('\n📋 测试结果汇总:');
  console.log(`   单元测试: ${results.unit ? '✅ 通过' : '❌ 失败'}`);
  console.log(`   集成测试: ${results.integration ? '✅ 通过' : '❌ 失败'}`);
  console.log(`   E2E 测试: ${results.e2e ? '✅ 通过' : '❌ 失败'}`);

  const allPassed = Object.values(results).every(result => result);
  if (allPassed) {
    console.log('\n🎉 所有测试通过！');
    process.exit(0);
  } else {
    console.log('\n❌ 部分测试失败');
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🧪 排序算法可视化 - 测试工具

使用方法:
  node test/scripts.js [命令] [选项]

命令:
  run [category] [filter]    运行指定类别的测试
  coverage                   生成覆盖率报告
  e2e [browser]              运行 E2E 测试
  quick                      运行快速测试 (跳过 E2E)
  full                       运行完整测试套件
  help                       显示此帮助信息

测试类别:
  unit       单元测试
  integration 集成测试
  component  组件测试
  e2e        E2E 测试
  all        所有测试

浏览器 (用于 E2E):
  all        所有浏览器 (默认)
  chromium   Chrome/Edge
  firefox    Firefox
  webkit     Safari

示例:
  node test/scripts.js run unit                # 运行单元测试
  node test/scripts.js run integration bubble  # 运行包含"bubble"的集成测试
  node test/scripts.js coverage                # 生成覆盖率报告
  node test/scripts.js e2e chromium           # 在 Chrome 上运行 E2E 测试
  node test/scripts.js quick                   # 运行快速测试
  node test/scripts.js full                    # 运行完整测试套件

快捷方式:
  npm test                   运行单元测试 (watch 模式)
  npm run test:ui           运行单元测试 (UI 界面)
  npm run test:coverage     生成覆盖率报告
  npm run test:e2e          运行 E2E 测试
  npm run test:quick        运行快速测试
  npm run test:full         运行完整测试套件
`);
}

// CLI 接口
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'run':
      const category = args[1] || 'all';
      const filter = args[2] || '';
      runTestsByCategory(category, filter);
      break;

    case 'coverage':
      generateCoverageReport();
      break;

    case 'e2e':
      const browser = args[1] || 'all';
      runE2ETests(browser);
      break;

    case 'quick':
      runQuickTests();
      break;

    case 'full':
      runFullTestSuite();
      break;

    case 'help':
    default:
      showHelp();
      break;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  runTestsByCategory,
  generateCoverageReport,
  runE2ETests,
  runQuickTests,
  runFullTestSuite
};
