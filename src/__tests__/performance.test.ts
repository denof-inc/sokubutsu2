import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PerformanceMonitor, performanceMonitor } from '../performance';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('基本的なメトリクス取得', () => {
    it('起動時間を測定できること', async () => {
      // 少し待機してから測定
      await new Promise(resolve => setTimeout(resolve, 10));

      const startupTime = monitor.getStartupTime();
      expect(startupTime).toBeGreaterThan(0);
      expect(startupTime).toBeLessThan(1000); // 1秒未満であること
    });

    it('メモリ使用量を取得できること', () => {
      const memoryUsage = monitor.getCurrentMemoryUsage();

      expect(memoryUsage).toBeGreaterThan(0);
      expect(memoryUsage).toBeLessThan(500); // 500MB未満であること
    });

    it('CPU使用率を取得できること', () => {
      const cpuUsage = monitor.getCpuUsage();

      expect(cpuUsage).toBeGreaterThanOrEqual(0);
      expect(cpuUsage).toBeLessThan(100);
    });

    it('メトリクスオブジェクトを取得できること', () => {
      const metrics = monitor.getMetrics();

      expect(metrics).toHaveProperty('startupTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('executionTime');
      expect(metrics).toHaveProperty('cpuUsage');

      expect(metrics.executionTime).toBe(0);
    });
  });

  describe('実行時間測定デコレータ', () => {
    it('正常に実行時間を測定できること', async () => {
      const testFunction = async (value: number): Promise<number> => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return value * 2;
      };

      const measuredFunction = PerformanceMonitor.measureExecutionTime(testFunction);
      const result = await measuredFunction(5);

      expect(result).toBe(10);
    });

    it('エラー時も実行時間を測定できること', async () => {
      const errorFunction = async (): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 20));
        throw new Error('Test error');
      };

      const measuredFunction = PerformanceMonitor.measureExecutionTime(errorFunction);

      await expect(measuredFunction()).rejects.toThrow('Test error');
    });
  });

  describe('パフォーマンス表示', () => {
    let consoleSpy: jest.SpiedFunction<typeof console.log>;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('メトリクスを表示できること', () => {
      monitor.displayMetrics();

      expect(consoleSpy).toHaveBeenCalledWith('📊 パフォーマンス指標:');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('起動時間:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('メモリ使用量:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CPU使用率:'));
    });

    it('起動時間が目標を超過した場合に警告を出すこと', () => {
      // 起動時間を強制的に2秒以上にする
      jest.spyOn(monitor, 'getStartupTime').mockReturnValue(2500);

      monitor.displayMetrics();

      expect(consoleSpy).toHaveBeenCalledWith('📊 パフォーマンス指標:');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('起動時間: 2500ms'));
    });

    it('メモリ使用量が目標を超過した場合に警告を出すこと', () => {
      // メモリ使用量を強制的に50MB以上にする
      jest.spyOn(monitor, 'getCurrentMemoryUsage').mockReturnValue(60);

      monitor.displayMetrics();

      expect(consoleSpy).toHaveBeenCalledWith('📊 パフォーマンス指標:');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('メモリ使用量: 60MB'));
    });

    it('メモリ使用量が目標を下回る場合に良好メッセージを出すこと', () => {
      // メモリ使用量を強制的に30MB未満にする
      jest.spyOn(monitor, 'getCurrentMemoryUsage').mockReturnValue(25);

      monitor.displayMetrics();

      expect(consoleSpy).toHaveBeenCalledWith('📊 パフォーマンス指標:');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('メモリ使用量: 25MB'));
    });
  });

  describe('グローバルインスタンス', () => {
    it('performanceMonitorがエクスポートされていること', () => {
      expect(performanceMonitor).toBeDefined();
      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
    });
  });
});
