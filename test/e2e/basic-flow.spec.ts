import { test, expect, type Page } from '@playwright/test';

/** 主题持久化键（与 themeStore 保持一致） */
const THEME_KEY = 'sort-visualizer-theme';

async function openApp(page: Page) {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
}

test.describe('排序可视化基础流程', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('页面应该正确加载', async ({ page }) => {
    await expect(page).toHaveTitle(/排序算法可视化/);
    await expect(page.locator('.control-panel')).toBeVisible();
    await expect(page.locator('.algorithm-view')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('应该显示默认算法界面（堆排序）', async ({ page }) => {
    const algorithmSelector = page.locator('.algo-dropdown');
    await expect(algorithmSelector).toBeVisible();
    await expect(algorithmSelector).toHaveValue('heap');

    // 堆排序特有的最大/最小堆切换按钮
    await expect(page.locator('.heap-mode-btn.max')).toBeVisible();
  });

  test('应该能够生成新的随机数组', async ({ page }) => {
    const sizeValue = page.locator('.size-value');
    const initialSize = await sizeValue.textContent();

    await page.getByRole('button', { name: '新数组' }).click();
    await page.waitForTimeout(300);

    // 数组大小不变（Canvas 渲染，无法比对柱子 DOM，验证控件状态稳定）
    await expect(sizeValue).toHaveText(initialSize ?? '');
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('应该能够调整数组大小', async ({ page }) => {
    const sizeSlider = page.locator('.size-slider');
    await sizeSlider.fill('50');
    await expect(page.locator('.size-value')).toHaveText('50');
  });

  test('应该能够调整动画速度', async ({ page }) => {
    const speedSlider = page.locator('.speed-slider');
    await expect(speedSlider).toHaveAttribute('min', '20');
    await expect(speedSlider).toHaveAttribute('max', '500');

    await speedSlider.fill('100');
    await expect(page.locator('.speed-value')).toHaveText('100ms');
  });

  test('应该能够切换算法', async ({ page }) => {
    const algorithmSelector = page.locator('.algo-dropdown');
    await algorithmSelector.selectOption('bubble');
    await expect(algorithmSelector).toHaveValue('bubble');

    // 堆排序特有控件应该消失
    await expect(page.locator('.heap-mode-btn')).toHaveCount(0);
  });

  test('播放控制按钮应该工作', async ({ page }) => {
    const playButton = page.locator('button[title="播放/暂停 Space"]');

    await playButton.click();
    await expect(page.locator('.pb-desc.playing')).toBeVisible();

    // 步骤推进后再暂停（步骤为 0 时暂停会回到 ready 态）
    await expect(page.locator('.pb-step-count')).toHaveText(/^[1-9]\d*\//);
    await playButton.click();
    await expect(page.locator('.pb-desc.paused')).toBeVisible();
  });

  test('单步执行应该工作', async ({ page }) => {
    await expect(page.locator('.pb-step-count')).toHaveText(/^0\//);

    await page.locator('button[title="单步前进 →"]').click();
    await expect(page.locator('.pb-step-count')).toHaveText(/^1\//);
  });

  test('重置按钮应该工作', async ({ page }) => {
    await page.locator('button[title="播放/暂停 Space"]').click();
    await page.waitForTimeout(500);

    await page.locator('button[title="重置 Home"]').click();
    await expect(page.locator('.pb-step-count')).toHaveText(/^0\//);
    await expect(page.locator('.pb-desc.ready')).toBeVisible();
  });

  test('当前操作描述应该显示', async ({ page }) => {
    await page.locator('button[title="播放/暂停 Space"]').click();

    // 播放中应显示状态文本与操作描述
    await expect(page.locator('.pb-status-text')).not.toBeEmpty();
    await expect(page.locator('.pb-desc-text')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('算法特定功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('堆排序模式切换应该工作', async ({ page }) => {
    // 默认最大堆
    await expect(page.locator('.heap-mode-btn.max')).toBeVisible();

    await page.locator('.heap-mode-btn').click();
    await expect(page.locator('.heap-mode-btn.min')).toBeVisible();
  });

  test('归并排序视图应该显示', async ({ page }) => {
    await page.locator('.algo-dropdown').selectOption('merge');
    await expect(page.locator('.algorithm-view')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('桶排序视图应该显示', async ({ page }) => {
    await page.locator('.algo-dropdown').selectOption('bucket');
    await expect(page.locator('.algorithm-view')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  });
});

test.describe('双主题系统', () => {
  test('切换器点击应该换装并持久化', async ({ page }) => {
    await openApp(page);

    // Playwright 默认亮色系统偏好 → 首次进入应为亮色（画室）
    await expect(page.locator('body')).toHaveClass(/theme-light/);
    const initialBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-1').trim(),
    );

    // 切到暗色（画廊）
    await page.locator('.theme-switch').click();
    await expect(page.locator('body')).toHaveClass(/theme-dark/);
    const darkBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-1').trim(),
    );
    expect(darkBg).toBe('#0b0e14');
    expect(darkBg).not.toBe(initialBg);
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('dark');

    // 刷新后保持暗色
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/theme-dark/);
  });

  test('Alt+D 应该切换主题', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('body')).toHaveClass(/theme-light/);

    await page.keyboard.press('Alt+d');
    await expect(page.locator('body')).toHaveClass(/theme-dark/);
  });

  test('暗色系统偏好且无存量时默认画廊（dark）', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openApp(page);
    await expect(page.locator('body')).toHaveClass(/theme-dark/);
  });
});

test.describe('响应式设计测试', () => {
  test('应该适应不同屏幕尺寸', async ({ page }) => {
    await openApp(page);

    for (const size of [
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator('.control-panel')).toBeVisible();
    }
  });

  test('Canvas 应该自适应容器大小', async ({ page }) => {
    await openApp(page);

    const initialSize = await page.locator('canvas').boundingBox();
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(300);

    const newSize = await page.locator('canvas').boundingBox();
    expect(newSize?.width).not.toBe(initialSize?.width);
  });
});

test.describe('性能和稳定性测试', () => {
  test('应该能够处理最大数组', async ({ page }) => {
    await openApp(page);

    await page.locator('.size-slider').fill('100');
    await expect(page.locator('.size-value')).toHaveText('100');

    await page.locator('button[title="播放/暂停 Space"]').click();
    await page.waitForTimeout(2000);

    await expect(page.locator('.algorithm-view')).toBeVisible();
  });

  test('长时间运行不应该崩溃', async ({ page }) => {
    await openApp(page);

    for (let i = 0; i < 3; i++) {
      await page.locator('button[title="播放/暂停 Space"]').click();
      await page.waitForTimeout(1500);
      await page.locator('button[title="重置 Home"]').click();
      await page.waitForTimeout(300);
    }

    await expect(page.locator('.algorithm-view')).toBeVisible();
  });
});

test.describe('可访问性测试', () => {
  test('控件应该有合适的标签', async ({ page }) => {
    await openApp(page);

    const inputs = page.locator('input, select');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const hasLabel = await inputs.nth(i).evaluate(
        (el) =>
          el.hasAttribute('aria-label') ||
          el.hasAttribute('title') ||
          el.labels.length > 0,
      );
      expect(hasLabel, `第 ${i} 个输入控件缺少标签`).toBe(true);
    }
  });

  test('按钮应该有合适的文本或 aria 标签', async ({ page }) => {
    await openApp(page);

    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      expect((text?.trim().length || 0) + (ariaLabel?.length || 0)).toBeGreaterThan(0);
    }
  });
});
