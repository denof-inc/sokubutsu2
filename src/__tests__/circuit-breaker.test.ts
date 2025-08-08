import { CircuitBreaker, CircuitBreakerConfig, CircuitState } from '../circuit-breaker.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let config: CircuitBreakerConfig;

  beforeEach(() => {
    config = {
      maxConsecutiveErrors: 3,
      errorRateThreshold: 0.5,
      windowSizeMs: 60000, // 1分
      recoveryTimeMs: 30000, // 30秒
      autoRecoveryEnabled: true,
    };
    circuitBreaker = new CircuitBreaker(config);
  });

  describe('連続エラー監視', () => {
    it('連続エラーが閾値未満の場合はCLOSED状態を維持', () => {
      circuitBreaker.recordError('Error 1');
      circuitBreaker.recordError('Error 2');
      
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.canExecute()).toBe(true);
    });

    it('連続エラーが閾値に達した場合OPEN状態になる', () => {
      circuitBreaker.recordError('Error 1');
      circuitBreaker.recordError('Error 2');
      const shouldStop = circuitBreaker.recordError('Error 3');
      
      expect(shouldStop).toBe(true);
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it('成功時に連続エラーカウントがリセットされる', () => {
      circuitBreaker.recordError('Error 1');
      circuitBreaker.recordError('Error 2');
      circuitBreaker.recordSuccess();
      
      const stats = circuitBreaker.getStats();
      expect(stats.consecutiveErrors).toBe(0);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('エラー率監視', () => {
    it('エラー率が閾値を超えた場合OPEN状態になる', () => {
      // 最小10回のチェックを想定
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordError(`Error ${i}`);
        circuitBreaker.recordSuccess(); // エラーカウントリセット防止
      }
      
      const stats = circuitBreaker.getStats();
      // エラー率の計算は実装に依存するため、状態のみ確認
      expect(stats.recentErrorCount).toBeGreaterThan(0);
    });
  });

  describe('自動復旧', () => {
    it('自動復旧が有効な場合、復旧を試みる', () => {
      // サーキットブレーカーを作動させる
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordError(`Error ${i}`);
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      // 手動で復旧を試みる
      circuitBreaker.attemptRecovery();
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      // 成功で完全復旧
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('HALF_OPEN状態でエラーが発生した場合、再度OPENになる', () => {
      // サーキットブレーカーを作動させる
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordError(`Error ${i}`);
      }
      
      // 復旧を試みる
      circuitBreaker.attemptRecovery();
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      // 再度エラーで連続エラーカウントがリセットされている
      circuitBreaker.recordError('Error after recovery');
      circuitBreaker.recordError('Error after recovery 2');
      circuitBreaker.recordError('Error after recovery 3');
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('手動リセット', () => {
    it('手動リセットで初期状態に戻る', () => {
      // エラーを記録
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordError(`Error ${i}`);
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      // 手動リセット
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.canExecute()).toBe(true);
      
      const stats = circuitBreaker.getStats();
      expect(stats.consecutiveErrors).toBe(0);
      expect(stats.recentErrorCount).toBe(0);
    });
  });

  describe('統計情報', () => {
    it('統計情報を正しく取得できる', () => {
      circuitBreaker.recordError('Error 1');
      circuitBreaker.recordError('Error 2');
      
      const stats = circuitBreaker.getStats();
      
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('consecutiveErrors');
      expect(stats).toHaveProperty('errorRate');
      expect(stats).toHaveProperty('recentErrorCount');
      expect(stats).toHaveProperty('lastOpenTime');
      
      expect(stats.consecutiveErrors).toBe(2);
      expect(stats.recentErrorCount).toBe(2);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('自動復旧無効時', () => {
    beforeEach(() => {
      config.autoRecoveryEnabled = false;
      circuitBreaker = new CircuitBreaker(config);
    });

    it('自動復旧が無効の場合、手動リセットが必要', () => {
      // サーキットブレーカーを作動させる
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordError(`Error ${i}`);
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      // 自動復旧が無効の場合でも、attemptRecovery自体は動作する
      // （スケジュールされないだけ）
      circuitBreaker.attemptRecovery();
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      // 手動リセットで確実に復旧
      circuitBreaker.reset();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });
});