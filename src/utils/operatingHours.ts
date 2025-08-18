import { config } from '../config.js';
import { vibeLogger } from '../logger.js';

/**
 * 運用時間管理ユーティリティ
 * 
 * @設計ドキュメント
 * - CLAUDE.md: 22時〜6時運用停止ルール
 * 
 * @関連クラス
 * - MonitoringScheduler: 監視サイクルでこのユーティリティを使用
 * - config.ts: 運用時間設定を管理
 * 
 * @主要機能
 * - 現在時刻が運用時間内かチェック
 * - 運用停止/再開の判定
 * - ログ出力とTelegram通知
 */

export interface OperatingHoursStatus {
  isOperating: boolean;
  currentHour: number;
  nextChangeHour: number;
  message: string;
}

/**
 * 現在時刻が運用時間内かどうかをチェック
 */
export function isWithinOperatingHours(): OperatingHoursStatus {
  if (!config.operatingHours?.enabled) {
    return {
      isOperating: true,
      currentHour: new Date().getHours(),
      nextChangeHour: -1,
      message: '運用時間制限は無効です',
    };
  }

  const now = new Date();
  const currentHour = parseInt(
    now.toLocaleString('en-US', {
      timeZone: config.operatingHours.timezone,
      hour12: false,
      hour: '2-digit',
    })
  );

  const { startHour, endHour } = config.operatingHours;
  
  // 22時〜6時の停止時間帯かチェック
  const isOperating = currentHour >= startHour && currentHour < endHour;
  
  // 次の状態変更時刻を計算
  let nextChangeHour: number;
  if (isOperating) {
    nextChangeHour = endHour; // 運用中 → 次は停止時刻
  } else {
    nextChangeHour = startHour; // 停止中 → 次は開始時刻
  }

  const status = isOperating ? '運用中' : '停止中';
  const nextAction = isOperating ? '停止' : '開始';
  
  vibeLogger.debug('operating_hours.check', '運用時間チェック', {
    context: {
      currentHour,
      startHour,
      endHour,
      isOperating,
      nextChangeHour,
      timezone: config.operatingHours.timezone,
    },
  });

  return {
    isOperating,
    currentHour,
    nextChangeHour,
    message: `現在${status}（${currentHour}時）- 次回${nextAction}: ${nextChangeHour}時`,
  };
}

/**
 * 運用時間外のスキップメッセージを生成
 */
export function createSkipMessage(): string {
  const status = isWithinOperatingHours();
  return `⏰ 運用時間外のため監視をスキップしました\n${status.message}`;
}

/**
 * 運用開始通知メッセージを生成
 */
export function createOperatingStartMessage(): string {
  return `🌅 *運用開始*\n\n⏰ *開始時刻*: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\n✅ 物件監視を再開しました`;
}

/**
 * 運用停止通知メッセージを生成
 */
export function createOperatingStopMessage(): string {
  return `🌙 *運用停止*\n\n⏰ *停止時刻*: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\n⏸ 物件監視を停止しました（22時〜6時）\n\n🌅 明朝6時に自動再開します`;
}

/**
 * 前回の運用状態を保存・取得するためのストレージ
 */
class OperatingStateStorage {
  private lastOperatingState: boolean | null = null;

  /**
   * 運用状態が変更されたかチェック
   */
  hasStateChanged(): { changed: boolean; currentState: boolean; previousState: boolean | null } {
    const currentState = isWithinOperatingHours().isOperating;
    const changed = this.lastOperatingState !== null && this.lastOperatingState !== currentState;
    const previousState = this.lastOperatingState;
    
    this.lastOperatingState = currentState;
    
    return {
      changed,
      currentState,
      previousState,
    };
  }

  /**
   * 現在の状態を記録
   */
  recordCurrentState(): void {
    this.lastOperatingState = isWithinOperatingHours().isOperating;
  }
}

export const operatingStateStorage = new OperatingStateStorage();