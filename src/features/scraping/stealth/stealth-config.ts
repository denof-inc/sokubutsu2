import { Page } from 'playwright';

export class StealthConfig {
  static getStealthOptions(): any {
    return {
      // User-Agent偽装
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

      // ヘッドレス検知回避
      headless: false, // 開発時はfalse、本番ではXvfb使用

      // ブラウザフィンガープリント偽装
      viewport: { width: 1366, height: 768 },

      // WebDriver検知回避
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // 高速化のため画像読み込み無効
        '--disable-javascript', // 初期アクセス時のみ無効
      ],
    };
  }

  static async setupStealthMode(page: Page): Promise<void> {
    // navigator.webdriver削除
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    // Chrome検知回避
    await page.addInitScript(() => {
      // @ts-expect-error Chrome API mock
      window.chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };
    });

    // プラグイン偽装
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    // 言語設定
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'ja', 'en-US', 'en'],
      });
    });

    // Canvas フィンガープリント対策
    await page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string) {
        if (type === '2d') {
          const context = originalGetContext.call(this, type);
          if (context) {
            const originalFillText = context.fillText;
            context.fillText = function (text: string, x: number, y: number) {
              // ランダムなノイズを追加
              const noise = Math.random() * 0.1;
              return originalFillText.call(this, text, x + noise, y + noise);
            };
          }
          return context;
        }
        return originalGetContext.call(this, type);
      };
    });
  }
}
