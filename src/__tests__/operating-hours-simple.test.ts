import { describe, it, expect } from '@jest/globals';
import {
  createOperatingStartMessage,
  createOperatingStopMessage,
} from '../utils/operatingHours.js';

describe('運用時間制限機能（基本テスト）', () => {
  describe('メッセージ生成', () => {
    it('運用開始メッセージを正しく生成', () => {
      const message = createOperatingStartMessage();
      
      expect(message).toContain('🌅 *運用開始*');
      expect(message).toContain('開始時刻');
      expect(message).toContain('物件監視を再開しました');
    });

    it('運用停止メッセージを正しく生成', () => {
      const message = createOperatingStopMessage();
      
      expect(message).toContain('🌙 *運用停止*');
      expect(message).toContain('停止時刻');
      expect(message).toContain('22時〜6時');
      expect(message).toContain('明朝6時に自動再開します');
    });
  });
});