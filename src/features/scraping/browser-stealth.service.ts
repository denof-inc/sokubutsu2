import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';

interface ExtendedWindow extends Window {
  chrome?: {
    runtime?: any;
  };
  __playwright?: any;
  __pw_manual?: any;
  __PW_inspect?: any;
}

@Injectable()
export class BrowserStealthService {
  private readonly logger = new Logger(BrowserStealthService.name);

  async applyStealthMeasures(page: Page): Promise<void> {
    await Promise.all([
      this.maskWebDriver(page),
      this.spoofUserAgent(page),
      this.setViewportAndDeviceMetrics(page),
      this.injectHumanBehavior(page),
      this.maskAutomationSignals(page),
    ]);
  }

  private async maskWebDriver(page: Page): Promise<void> {
    // WebDriverプロパティの隠蔽
    await page.addInitScript(() => {
      // navigator.webdriverを隠蔽
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Chrome DevTools Protocol の隠蔽
      const win = window as ExtendedWindow;
      if (win.chrome) {
        win.chrome.runtime = undefined;
      }

      // Playwright特有のプロパティの隠蔽
      delete win.__playwright;
      delete win.__pw_manual;
      delete win.__PW_inspect;

      // ChromeDriverの痕跡を除去
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = function (...args: any[]) {
        return args[0]?.name === 'notifications'
          ? Promise.resolve({ state: 'default' as PermissionState })
          : originalQuery.apply(this, args);
      };
    });
  }

  private async spoofUserAgent(page: Page): Promise<void> {
    // 実際のブラウザのUser-Agentを使用
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];

    const _randomUserAgent =
      userAgents[Math.floor(Math.random() * userAgents.length)];
    // Playwrightではcontext作成時にsetUserAgentを設定する必要がある
    // ここではヘッダーのみ設定

    // Accept-Language ヘッダーの設定
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    });
  }

  private async setViewportAndDeviceMetrics(page: Page): Promise<void> {
    // 一般的なデスクトップ解像度を使用
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
    ];

    const randomViewport =
      viewports[Math.floor(Math.random() * viewports.length)];
    await page.setViewportSize(randomViewport);

    // デバイスメトリクスの設定
    await page.addInitScript((viewport) => {
      Object.defineProperty(screen, 'width', { get: () => viewport.width });
      Object.defineProperty(screen, 'height', { get: () => viewport.height });
      Object.defineProperty(screen, 'availWidth', {
        get: () => viewport.width,
      });
      Object.defineProperty(screen, 'availHeight', {
        get: () => viewport.height - 40,
      });

      // 画面色深度
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

      // デバイスピクセル比
      Object.defineProperty(window, 'devicePixelRatio', { get: () => 1 });
    }, randomViewport);
  }

  private async injectHumanBehavior(page: Page): Promise<void> {
    // 人間らしいマウス移動とクリック動作
    await page.addInitScript(() => {
      // マウスイベントのランダム化
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (
        type,
        listener,
        options,
      ) {
        if (type === 'click') {
          const wrappedListener = function (this: any, event: Event) {
            // ランダムな遅延を追加
            setTimeout(
              () => {
                if (typeof listener === 'function') {
                  listener.call(this, event);
                } else if (
                  listener &&
                  typeof listener.handleEvent === 'function'
                ) {
                  listener.handleEvent.call(listener, event);
                }
              },
              Math.random() * 100 + 50,
            );
          };
          return originalAddEventListener.call(
            this,
            type,
            wrappedListener,
            options,
          );
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
    });

    // ページ読み込み後の自然な待機
    page.on('load', async () => {
      await this.randomDelay(1000, 3000);
    });
  }

  private async maskAutomationSignals(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // プラグイン情報の偽装
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const pluginArray = [
            {
              name: 'Chrome PDF Plugin',
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              item: (index: number) =>
                index === 0
                  ? {
                      type: 'application/x-google-chrome-pdf',
                      suffixes: 'pdf',
                      description: 'Portable Document Format',
                      enabledPlugin: null,
                    }
                  : null,
              namedItem: () => null,
              refresh: () => {},
            },
            {
              name: 'Chrome PDF Viewer',
              description: 'Portable Document Format',
              filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              length: 1,
              item: (index: number) =>
                index === 0
                  ? {
                      type: 'application/pdf',
                      suffixes: 'pdf',
                      description: 'Portable Document Format',
                      enabledPlugin: null,
                    }
                  : null,
              namedItem: () => null,
              refresh: () => {},
            },
            {
              name: 'Native Client',
              description: 'Native Client',
              filename: 'internal-nacl-plugin',
              length: 2,
              item: (_index: number) => null,
              namedItem: () => null,
              refresh: () => {},
            },
          ];

          pluginArray.length = 3;
          return pluginArray;
        },
      });

      // 言語設定の偽装
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'ja', 'en-US', 'en'],
      });

      Object.defineProperty(navigator, 'language', {
        get: () => 'ja-JP',
      });

      // WebGL情報の偽装
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.call(this, parameter);
      };

      const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter2.call(this, parameter);
      };

      // Canvas フィンガープリンティング対策
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...args: any[]) {
        const context = this.getContext('2d');
        if (context) {
          // わずかなノイズを追加
          const imageData = context.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] =
              (imageData.data[i] as number) + (Math.random() * 2 - 1);
            imageData.data[i + 1] =
              (imageData.data[i + 1] as number) + (Math.random() * 2 - 1);
            imageData.data[i + 2] =
              (imageData.data[i + 2] as number) + (Math.random() * 2 - 1);
          }
          context.putImageData(imageData, 0, 0);
        }
        return originalToDataURL.apply(this, args);
      };

      // AudioContext フィンガープリンティング対策
      const win = window as any;
      const AudioContextConstructor =
        win.AudioContext || win.webkitAudioContext;
      if (AudioContextConstructor) {
        const originalCreateOscillator =
          AudioContextConstructor.prototype.createOscillator;
        AudioContextConstructor.prototype.createOscillator = function () {
          const oscillator = originalCreateOscillator.call(this);
          const originalFrequencyValue = oscillator.frequency.value;
          oscillator.frequency.value =
            originalFrequencyValue * (1 + (Math.random() * 0.0001 - 0.00005));
          return oscillator;
        };
      }
    });
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async simulateHumanInteraction(page: Page): Promise<void> {
    // ランダムなスクロール
    await page.evaluate(() => {
      const scrollHeight = document.body.scrollHeight;
      const randomScroll = Math.random() * (scrollHeight * 0.3);
      window.scrollTo({
        top: randomScroll,
        behavior: 'smooth',
      });
    });

    // ランダムな待機
    await this.randomDelay(500, 2000);

    // マウス移動のシミュレーション
    const viewport = page.viewportSize();
    if (viewport) {
      const startX = Math.random() * viewport.width;
      const startY = Math.random() * viewport.height;
      const endX = Math.random() * viewport.width;
      const endY = Math.random() * viewport.height;

      // ベジェ曲線に沿った自然なマウス移動
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = startX + (endX - startX) * t;
        const y = startY + (endY - startY) * t;
        await page.mouse.move(x, y);
        await this.randomDelay(20, 50);
      }
    }
  }
}
