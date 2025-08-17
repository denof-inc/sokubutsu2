import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { vibeLogger } from './logger.js';

puppeteer.use(StealthPlugin());

export interface ResolveOptions { timeoutMs?: number }

/**
 * 認証ページを最小コストでクリアするためのCookie取得専用Resolver
 * - 画像/フォント等をブロック
 * - 1ページのみを開いてCookieを抽出
 */
export async function resolveCookies(url: string, opts: ResolveOptions = {}): Promise<string | null> {
  // 常にnullを返してPuppeteerにフォールバック
  vibeLogger.debug('challenge.resolver.disabled', 'resolveCookies無効化（Puppeteerへフォールバック）', {});
  return null;
}
