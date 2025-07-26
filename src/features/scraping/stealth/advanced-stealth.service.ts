import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';

@Injectable()
export class AdvancedStealthService {
  private readonly logger = new Logger(AdvancedStealthService.name);

  async setupUltimateStealthMode(page: Page): Promise<void> {
    // 1. WebDriver検知完全回避
    await page.addInitScript(() => {
      // navigator.webdriver完全削除
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // webdriver関連プロパティの完全削除
      delete (window as any).webdriver;
      delete (navigator as any).webdriver;
    });

    // 2. Chrome検知回避（より高度）
    await page.addInitScript(() => {
      // 実際のChromeブラウザと同じオブジェクト構造を作成
      (window as any).chrome = {
        app: {
          isInstalled: false,
          InstallState: {
            DISABLED: 'disabled',
            INSTALLED: 'installed',
            NOT_INSTALLED: 'not_installed',
          },
          RunningState: {
            CANNOT_RUN: 'cannot_run',
            READY_TO_RUN: 'ready_to_run',
            RUNNING: 'running',
          },
        },
        runtime: {
          onConnect: null,
          onMessage: null,
          onConnectExternal: null,
          onMessageExternal: null,
        },
        loadTimes: function () {
          return {
            requestTime: Date.now() * 0.001,
            startLoadTime: Date.now() * 0.001,
            commitLoadTime: Date.now() * 0.001,
            finishDocumentLoadTime: Date.now() * 0.001,
            finishLoadTime: Date.now() * 0.001,
            firstPaintTime: Date.now() * 0.001,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasFetchedViaSpdy: false,
            wasNpnNegotiated: false,
            npnNegotiatedProtocol: 'unknown',
            wasAlternateProtocolAvailable: false,
            connectionInfo: 'unknown',
          };
        },
        csi: function () {
          return {
            startE: Date.now(),
            onloadT: Date.now(),
            pageT: Date.now(),
            tran: 15,
          };
        },
      };
    });

    // 3. プラグイン偽装（実際のブラウザと同じ）
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            {
              0: {
                type: 'application/x-google-chrome-pdf',
                suffixes: 'pdf',
                description: 'Portable Document Format',
                enabledPlugin: null,
              },
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin',
            },
            {
              0: {
                type: 'application/pdf',
                suffixes: 'pdf',
                description: '',
                enabledPlugin: null,
              },
              description: '',
              filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              length: 1,
              name: 'Chrome PDF Viewer',
            },
            {
              0: {
                type: 'application/x-nacl',
                suffixes: '',
                description: 'Native Client Executable',
                enabledPlugin: null,
              },
              1: {
                type: 'application/x-pnacl',
                suffixes: '',
                description: 'Portable Native Client Executable',
                enabledPlugin: null,
              },
              description: '',
              filename: 'internal-nacl-plugin',
              length: 2,
              name: 'Native Client',
            },
          ];

          Object.defineProperty(plugins, 'length', {
            get: () => 3,
          });

          return plugins;
        },
      });
    });

    // 4. 言語設定の完全偽装
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'ja', 'en-US', 'en'],
      });

      Object.defineProperty(navigator, 'language', {
        get: () => 'ja-JP',
      });
    });

    // 5. Canvas フィンガープリント高度対策
    await page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const originalGetImageData =
        CanvasRenderingContext2D.prototype.getImageData;

      // Canvas getContext偽装
      HTMLCanvasElement.prototype.getContext = function (
        type: string,
        attributes?: any,
      ) {
        const context = originalGetContext.call(this, type, attributes);

        if (type === '2d' && context) {
          // fillText偽装
          const originalFillText = context.fillText;
          context.fillText = function (
            text: string,
            x: number,
            y: number,
            maxWidth?: number,
          ) {
            const noise = () => Math.random() * 0.0001;
            return originalFillText.call(
              this,
              text,
              x + noise(),
              y + noise(),
              maxWidth,
            );
          };

          // strokeText偽装
          const originalStrokeText = context.strokeText;
          context.strokeText = function (
            text: string,
            x: number,
            y: number,
            maxWidth?: number,
          ) {
            const noise = () => Math.random() * 0.0001;
            return originalStrokeText.call(
              this,
              text,
              x + noise(),
              y + noise(),
              maxWidth,
            );
          };
        }

        return context;
      };

      // toDataURL偽装
      HTMLCanvasElement.prototype.toDataURL = function (
        type?: string,
        quality?: any,
      ) {
        const dataURL = originalToDataURL.call(this, type, quality);
        // 微細なノイズを追加
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = this.width;
          canvas.height = this.height;
          ctx.drawImage(this, 0, 0);

          // ランダムピクセルに微細な変更を加える
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            if (Math.random() < 0.001) {
              // 0.1%の確率で変更
              imageData.data[i] = Math.min(
                255,
                imageData.data[i] + Math.floor(Math.random() * 3) - 1,
              );
            }
          }
          ctx.putImageData(imageData, 0, 0);
          return canvas.toDataURL(type, quality);
        }
        return dataURL;
      };
    });

    // 6. WebGL フィンガープリント対策
    await page.addInitScript(() => {
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (
        parameter: number,
      ) {
        // VENDOR と RENDERER を偽装
        if (parameter === 37445) {
          // VENDOR
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          // RENDERER
          return 'Intel(R) HD Graphics 620';
        }
        return originalGetParameter.call(this, parameter);
      };
    });

    // 7. AudioContext フィンガープリント対策
    await page.addInitScript(() => {
      const AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
        AudioContext.prototype.createAnalyser = function () {
          const analyser = originalCreateAnalyser.call(this);
          const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
          analyser.getFloatFrequencyData = function (array: Float32Array) {
            originalGetFloatFrequencyData.call(this, array);
            // 微細なノイズを追加
            for (let i = 0; i < array.length; i++) {
              array[i] += Math.random() * 0.0001;
            }
          };
          return analyser;
        };
      }
    });

    // 8. Screen解像度の自然な設定
    await page.addInitScript(() => {
      Object.defineProperty(screen, 'width', {
        get: () => 1920,
      });
      Object.defineProperty(screen, 'height', {
        get: () => 1080,
      });
      Object.defineProperty(screen, 'availWidth', {
        get: () => 1920,
      });
      Object.defineProperty(screen, 'availHeight', {
        get: () => 1040,
      });
      Object.defineProperty(screen, 'colorDepth', {
        get: () => 24,
      });
      Object.defineProperty(screen, 'pixelDepth', {
        get: () => 24,
      });
    });

    // 9. Timezone偽装
    await page.addInitScript(() => {
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function () {
        return -540; // JST (UTC+9)
      };
    });

    // 10. Battery API無効化
    await page.addInitScript(() => {
      if ('getBattery' in navigator) {
        delete (navigator as any).getBattery;
      }
    });

    this.logger.debug('Ultimate stealth mode configured');
  }

  async simulateNaturalBehavior(page: Page): Promise<void> {
    // より自然なマウス移動パターン
    const viewport = page.viewportSize();
    if (viewport) {
      // ベジェ曲線を使った自然なマウス移動
      const startX = Math.random() * viewport.width;
      const startY = Math.random() * viewport.height;

      for (let i = 0; i < 5; i++) {
        const targetX = Math.random() * viewport.width;
        const targetY = Math.random() * viewport.height;

        // ベジェ曲線の制御点
        const cp1X =
          startX + (targetX - startX) * 0.25 + (Math.random() - 0.5) * 100;
        const cp1Y =
          startY + (targetY - startY) * 0.25 + (Math.random() - 0.5) * 100;
        const cp2X =
          startX + (targetX - startX) * 0.75 + (Math.random() - 0.5) * 100;
        const cp2Y =
          startY + (targetY - startY) * 0.75 + (Math.random() - 0.5) * 100;

        // 曲線に沿ったマウス移動
        for (let t = 0; t <= 1; t += 0.1) {
          const x =
            Math.pow(1 - t, 3) * startX +
            3 * Math.pow(1 - t, 2) * t * cp1X +
            3 * (1 - t) * Math.pow(t, 2) * cp2X +
            Math.pow(t, 3) * targetX;
          const y =
            Math.pow(1 - t, 3) * startY +
            3 * Math.pow(1 - t, 2) * t * cp1Y +
            3 * (1 - t) * Math.pow(t, 2) * cp2Y +
            Math.pow(t, 3) * targetY;

          await page.mouse.move(x, y);
          await page.waitForTimeout(20 + Math.random() * 30);
        }

        await page.waitForTimeout(100 + Math.random() * 200);
      }
    }

    // 自然なスクロールパターン
    const scrollSteps = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < scrollSteps; i++) {
      const scrollAmount = 100 + Math.random() * 200;
      await page.evaluate((amount) => {
        window.scrollBy(0, amount);
      }, scrollAmount);
      await page.waitForTimeout(200 + Math.random() * 300);
    }

    // ランダムなキーボードイベント（非表示）
    const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'];
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.press(randomKey);
    await page.waitForTimeout(100 + Math.random() * 200);

    this.logger.debug('Natural behavior simulation completed');
  }
}
