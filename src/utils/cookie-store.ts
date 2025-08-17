import fs from 'fs';
import path from 'path';

interface CookieRecord {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number | undefined; // epoch ms
  secure?: boolean;
  updatedAt: number;
}

interface CookieDB { cookies: CookieRecord[] }

export class CookieStore {
  private readonly filePath: string;
  private db: CookieDB = { cookies: [] };
  private readonly ttlMs: number;

  constructor(storageDir: string, filename = 'athome.cookies.json', ttlHours = 12) {
    this.filePath = path.join(storageDir, filename);
    this.ttlMs = ttlHours * 60 * 60 * 1000;
    this.load();
  }

  load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && parsed !== null && 'cookies' in parsed && Array.isArray((parsed as { cookies: unknown }).cookies)) {
          this.db = { cookies: (parsed as { cookies: CookieRecord[] }).cookies };
        } else {
          // 旧フォーマット(entries) や未知の形式は初期化
          this.db = { cookies: [] };
        }
      }
    } catch {
      this.db = { cookies: [] };
    }
  }

  save(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  getHeader(hostname: string, path: string = '/'): string {
    const now = Date.now();
    const valid = this.db.cookies.filter(c => !c.expires || c.expires > now);
    const matches = valid.filter(c => {
      const dom = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
      if (!hostname.endsWith(dom)) return false;
      return (path || '/').startsWith(c.path || '/');
    });
    const map = new Map<string, string>();
    for (const ck of matches) map.set(ck.name, ck.value);
    return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  setFromSetCookie(setCookies: string[] | undefined, fallbackDomain: string): void {
    if (!setCookies || setCookies.length === 0) return;
    for (const sc of setCookies) {
      const rec = this.parseSetCookie(sc, fallbackDomain);
      if (!rec) continue;
      const idx = this.db.cookies.findIndex(c => c.name === rec.name && c.domain === rec.domain && c.path === rec.path);
      if (idx >= 0) this.db.cookies[idx] = rec; else this.db.cookies.push(rec);
    }
    this.save();
  }

  private parseSetCookie(sc: string, fallbackDomain: string): CookieRecord | null {
    const parts = sc.split(';').map(s => s.trim());
    const [nv, ...attrs] = parts;
    if (!nv) return null;
    const eq = nv.indexOf('=');
    if (eq < 0) return null;
    const name = nv.slice(0, eq).trim();
    const value = nv.slice(eq + 1);
    let domain = fallbackDomain;
    let path = '/';
    let expires: number | undefined;
    let secure = false;
    for (const raw of attrs) {
      const [k, ...rest] = raw.split('=');
      if (!k) continue;
      const key = k.toLowerCase();
      const val = rest.join('=').trim();
      if (key === 'domain' && val) domain = val.startsWith('.') ? val : `.${val}`;
      else if (key === 'path' && val) path = val;
      else if (key === 'expires' && val) {
        const ts = Date.parse(val);
        if (!Number.isNaN(ts)) expires = ts;
      } else if (key === 'secure') secure = true;
    }
    return { name, value, domain, path, expires, secure, updatedAt: Date.now() };
  }

  /**
   * Puppeteerで取得したCookieを保存
   */
  saveCookies(url: string, cookies: Array<{ name: string; value: string; domain: string; path: string; expires?: number }>): void {
    const urlObj = new URL(url);
    const defaultDomain = `.${urlObj.hostname}`;
    
    for (const cookie of cookies) {
      const rec: CookieRecord = {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || defaultDomain,
        path: cookie.path || '/',
        expires: cookie.expires ? cookie.expires * 1000 : Date.now() + (24 * 60 * 60 * 1000), // 24時間後
        secure: false,
        updatedAt: Date.now()
      };
      
      const idx = this.db.cookies.findIndex(c => 
        c.name === rec.name && c.domain === rec.domain && c.path === rec.path
      );
      
      if (idx >= 0) {
        this.db.cookies[idx] = rec;
      } else {
        this.db.cookies.push(rec);
      }
    }
    
    this.save();
  }

  /**
   * 指定URLのCookieが有効期限内かチェック
   */
  isValid(url: string): boolean {
    const urlObj = new URL(url);
    const now = Date.now();
    
    // 有効なCookieを取得
    const validCookies = this.db.cookies.filter(c => {
      // 期限切れチェック
      if (c.expires && c.expires <= now) return false;
      
      // ドメインマッチング
      const dom = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
      if (!urlObj.hostname.endsWith(dom)) return false;
      
      // パスマッチング
      const cookiePath = c.path || '/';
      if (!urlObj.pathname.startsWith(cookiePath)) return false;
      
      return true;
    });
    
    // 重要なCookie（認証関連）が存在するかチェック
    const hasAuthCookies = validCookies.some(c => 
      c.name.toLowerCase().includes('session') || 
      c.name.toLowerCase().includes('auth') ||
      c.name.toLowerCase().includes('token') ||
      c.name.toLowerCase().includes('csrf') ||
      c.name === 'a_i' || // アットホーム固有の認証Cookie
      c.name === 'a_s' || 
      c.name === 'reese84' // 重要な認証Cookie
    );
    
    // Cookie更新から30分以内かチェック（24時間→30分に短縮）
    const recentCookies = validCookies.filter(c => 
      c.updatedAt && (now - c.updatedAt) < (30 * 60 * 1000) // 30分
    );
    
    // 緩和された条件: 最近更新されたCookieが3個以上かつ認証Cookieがある場合
    const isRecentlyValid = recentCookies.length >= 3 && hasAuthCookies && 
      recentCookies.some(c => c.name === 'reese84' || c.name === 'a_i');
    
    return isRecentlyValid;
  }

  /**
   * 期限切れCookieをクリーンアップ
   */
  cleanup(): void {
    const now = Date.now();
    const before = this.db.cookies.length;
    this.db.cookies = this.db.cookies.filter(c => !c.expires || c.expires > now);
    const after = this.db.cookies.length;
    
    if (before !== after) {
      this.save();
    }
  }
}
