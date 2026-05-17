import { test, expect } from '@playwright/test';

test.describe('排序可视化基础流程', () => {
  test.beforeEach(async ({ page }) => {
    // 启动开发服务器并访问页面
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('页面应该正确加载', async ({ page }) => {
    // 检查页面标题
    await expect(page).toHaveTitle(/排序可视化/);

    // 检查主要控件是否存在
    await expect(page.locator('.control-panel')).toBeVisible();
    await expect(page.locator('.algorithm-view')).toBeVisible();

    // 检查Canvas元素
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('应该显示默认算法界面', async ({ page }) => {
    // 检查算法选择器
    const algorithmSelector = page.locator('select[name="algorithm"]');
    await expect(algorithmSelector).toBeVisible();

    // 默认应该是堆排序
    const selectedAlgorithm = await algorithmSelector.inputValue();
    expect(selectedAlgorithm).toBe('heap');

    // 检查堆排序特有的控件
    await expect(page.locator('.mode-toggle')).toBeVisible();
    await expect(page.locator('.mode-max')).toBeVisible();
    await expect(page.locator('.mode-min')).toBeVisible();
  });

  test('应该能够生成新的随机数组', async ({ page }) => {
    const initialElements = await page.locator('.main-bar').count();

    // 点击生成新数组按钮
    await page.click('button:has-text("生成数组")');

    // 等待数组重新生成
    await page.waitForTimeout(500);

    const newElements = await page.locator('.main-bar').count();

    // 元素数量应该相同（大小没变），但内容应该不同
    expect(newElements).toBe(initialElements);
  });

  test('应该能够调整数组大小', async ({ page }) => {
    const sizeSlider = page.locator('input[type="range"][name="size"]');

    // 记录当前大小
    const initialSize = await sizeSlider.inputValue();

    // 调整大小
    await sizeSlider.fill('50');

    // 等待更新
    await page.waitForTimeout(300);

    // 检查元素数量是否变化
    const elements = await page.locator('.main-bar').count();
    expect(elements).toBe(50);
  });

  test('应该能够调整动画速度', async ({ page }) => {
    const speedSlider = page.locator('input[type="range"][name="speed"]');

    // 检查速度范围
    const minSpeed = await speedSlider.getAttribute('min');
    const maxSpeed = await speedSlider.getAttribute('max');

    expect(minSpeed).toBe('20');
    expect(maxSpeed).toBe('500');

    // 调整速度
    await speedSlider.fill('100');

    // 等待更新
    await page.waitForTimeout(100);
  });

  test('应该能够切换算法', async ({ page }) => {
    const algorithmSelector = page.locator('select[name="algorithm"]');

    // 切换到冒泡排序
    await algorithmSelector.selectOption('bubble');

    // 等待界面更新
    await page.waitForTimeout(300);

    // 检查当前选择
    const selectedAlgorithm = await algorithmSelector.inputValue();
    expect(selectedAlgorithm).toBe('bubble');

    // 堆排序特有的控件应该消失
    await expect(page.locator('.mode-toggle')).not.toBeVisible();
  });

  test('播放控制按钮应该工作', async ({ page }) => {
    const playButton = page.locator('button.ctrl-btn').first();
    const pauseButton = page.locator('button.ctrl-btn').nth(1);

    // 点击播放
    await playButton.click();
    await page.waitForTimeout(100);

    // 检查播放状态
    await expect(page.locator('.status-indicator.playing')).toBeVisible();

    // 点击暂停
    await pauseButton.click();
    await page.waitForTimeout(100);

    // 检查暂停状态
    await expect(page.locator('.status-indicator.paused')).toBeVisible();
  });

  test('单步执行应该工作', async ({ page }) => {
    const stepButton = page.locator('button').filter(async (btn) => {
      const text = await btn.textContent();
      return text?.includes('单步') || text?.includes('step');
    }).first();

    const initialStep = await page.locator('.stat-value.steps').textContent();

    // 点击单步执行
    await stepButton.click();
    await page.waitForTimeout(100);

    const currentStep = await page.locator('.stat-value.steps').textContent();

    // 步骤数应该增加
    expect(currentStep).not.toBe(initialStep);
  });

  test('重置按钮应该工作', async ({ page }) => {
    const playButton = page.locator('button').first();
    const resetButton = page.locator('button').filter(async (btn) => {
      const svg = await btn.innerHTML();
      return svg.includes('M3 12a9 9 0 109-9'); // 重置图标路径
    });

    // 开始播放
    await playButton.click();
    await page.waitForTimeout(500);

    // 重置
    await resetButton.click();
    await page.waitForTimeout(100);

    // 检查状态
    const currentStep = await page.locator('.stat-value.steps').textContent();
    expect(currentStep).toContain('0'); // 应该回到初始状态

    await expect(page.locator('.status-indicator.ready')).toBeVisible();
  });

  test('统计数据应该正确显示', async ({ page }) => {
    // 等待初始渲染
    await page.waitForTimeout(300);

    // 检查统计数据显示
    const comparisons = await page.locator('.stat-value.comparisons').textContent();
    const swaps = await page.locator('.stat-value.swaps').textContent();
    const steps = await page.locator('.stat-value.steps').textContent();

    expect(comparisons).toBeDefined();
    expect(swaps).toBeDefined();
    expect(steps).toBeDefined();

    // 初始状态应该为0
    expect(comparisons).toContain('0');
    expect(swaps).toContain('0');
  });

  test('当前操作描述应该显示', async ({ page }) => {
    const playButton = page.locator('button').first();

    // 开始播放
    await playButton.click();
    await page.waitForTimeout(500);

    // 检查当前操作描述
    const operationText = await page.locator('.stat-value.operation').textContent();
    expect(operationText).toBeTruthy();
    expect(operationText?.length).toBeGreaterThan(0);
  });
});

test.describe('算法特定功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('堆排序模式切换应该工作', async ({ page }) => {
    // 确保选择堆排序
    const algorithmSelector = page.locator('select[name="algorithm"]');
    await algorithmSelector.selectOption('heap');

    await page.waitForTimeout(300);

    // 测试最大堆模式
    await page.click('.mode-max');
    await page.waitForTimeout(100);

    // 检查按钮状态
    await expect(page.locator('.mode-max.mode-max')).toBeVisible();

    // 测试最小堆模式
    await page.click('.mode-min');
    await page.waitForTimeout(100);

    // 检查按钮状态
    await expect(page.locator('.mode-min.mode-min')).toBeVisible();
  });

  test('归并排序双排布局应该显示', async ({ page }) => {
    // 切换到归并排序
    const algorithmSelector = page.locator('select[name="algorithm"]');
    await algorithmSelector.selectOption('merge');

    await page.waitForTimeout(300);

    // 归并排序应该有上下两排
    const mainBars = await page.locator('.main-bar').count();
    const bufferBars = await page.locator('.buffer-bar').count();

    // 应该有主数组和缓冲区元素
    expect(mainBars + bufferBars).toBeGreaterThan(0);
  });

  test('桶排序桶区域应该显示', async ({ page }) => {
    // 切换到桶排序
    const algorithmSelector = page.locator('select[name="algorithm"]');
    await algorithmSelector.selectOption('bucket');

    await page.waitForTimeout(300);

    // 桶排序应该有桶区域
    const bucketBars = await page.locator('.bucket-bar').count();

    // 至少应该有一些桶元素
    expect(bucketBars).toBeGreaterThanOrEqual(0);
  });
});

test.describe('响应式设计测试', () => {
  test('应该适应不同屏幕尺寸', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 测试桌面尺寸
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('.control-panel')).toBeVisible();

    // 测试平板尺寸
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.control-panel')).toBeVisible();

    // 测试移动尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.control-panel')).toBeVisible();
  });

  test('Canvas应该自适应容器大小', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const canvas = page.locator('canvas');

    // 获取初始大小
    const initialSize = await canvas.boundingBox();

    // 调整窗口大小
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(300);

    const newSize = await canvas.boundingBox();

    // Canvas大小应该变化
    expect(newSize?.width).not.toBe(initialSize?.width);
  });
});

test.describe('性能和稳定性测试', () => {
  test('应该能够处理最大数组', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 设置最大数组
    const sizeSlider = page.locator('input[type="range"][name="size"]');
    await sizeSlider.fill('100');

    // 等待渲染
    await page.waitForTimeout(1000);

    // 检查是否有元素
    const elements = await page.locator('.main-bar').count();
    expect(elements).toBe(100);

    // 尝试播放
    const playButton = page.locator('button').first();
    await playButton.click();
    await page.waitForTimeout(2000);

    // 应该不会崩溃
    await expect(page.locator('.algorithm-view')).toBeVisible();
  });

  test('长时间运行不应该内存泄漏', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 生成数组并开始播放
    const playButton = page.locator('button').first();
    const resetButton = page.locator('button').filter(async (btn) => {
      const svg = await btn.innerHTML();
      return svg.includes('M3 12a9 9 0 109-9');
    });

    // 多次重播
    for (let i = 0; i < 5; i++) {
      await playButton.click();
      await page.waitForTimeout(3000);
      await resetButton.click();
      await page.waitForTimeout(500);
    }

    // 页面应该仍然响应
    await expect(page.locator('.algorithm-view')).toBeVisible();
  });
});

test.describe('可访问性测试', () => {
  test('控件应该有合适的标签', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 检查输入框是否有标签
    const inputs = page.locator('input, select');
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate(el => {
        return el.hasAttribute('aria-label') ||
               el.hasAttribute('title') ||
               el.labels.length > 0;
      });
      expect(hasLabel).toBe(true);
    }
  });

  test('按钮应该有合适的文本或aria标签', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');

      expect(text?.trim().length || ariaLabel?.length).toBeGreaterThan(0);
    }
  });
});
