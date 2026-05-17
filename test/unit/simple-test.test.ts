import { describe, test, expect } from 'vitest';

describe('简单测试', () => {
  test('基本数学运算', () => {
    expect(1 + 1).toBe(2);
  });

  test('数组操作', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
  });

  test('字符串操作', () => {
    const str = 'hello';
    expect(str.toUpperCase()).toBe('HELLO');
  });
});
