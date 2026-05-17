# 测试环境配置指南

## 安装测试依赖

```bash
# 核心测试框架
npm install -D vitest @vitest/ui @vitest/coverage-v8

# Vue 测试工具
npm install -D @vue/test-utils

# 测试运行环境
npm install -D happy-dom # 或 jsdom

# E2E 测试（已有 playwright）
npm install -D @playwright/test

# 类型支持和工具
npm install -D @types/jsdom
```

## vitest.config.ts 配置

```typescript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'src/main.ts'
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      }
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
```

## package.json 脚本

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```
