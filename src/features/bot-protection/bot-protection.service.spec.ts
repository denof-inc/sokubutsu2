import { Test, TestingModule } from '@nestjs/testing';
import { BotProtectionService } from './bot-protection.service';
import { chromium } from 'playwright';

jest.mock('playwright');

describe('BotProtectionService', () => {
  let service: BotProtectionService;
  let mockBrowser: any;
  let mockContext: any;
  let mockPage: any;

  beforeEach(async () => {
    // Playwrightのモック設定
    mockPage = {
      goto: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      locator: jest.fn().mockReturnValue({
        click: jest.fn().mockResolvedValue(undefined),
        type: jest.fn().mockResolvedValue(undefined),
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(true),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      }),
      keyboard: {
        press: jest.fn().mockResolvedValue(undefined),
      },
      waitForLoadState: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      cookies: jest.fn().mockResolvedValue([]),
      addCookies: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn().mockResolvedValue(undefined),
    };

    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [BotProtectionService],
    }).compile();

    service = module.get<BotProtectionService>(BotProtectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateSession', () => {
    it('新しいセッションを作成すること', async () => {
      const domain = 'example.com';
      const context = await service.getOrCreateSession(domain);

      expect(context).toBeDefined();
      expect(mockBrowser.newContext).toHaveBeenCalled();
    });

    it('既存のセッションを再利用すること', async () => {
      const domain = 'example.com';

      // 最初のセッション作成
      const context1 = await service.getOrCreateSession(domain);

      // 2回目は同じセッションを返す
      const context2 = await service.getOrCreateSession(domain);

      expect(context1).toBe(context2);
      expect(mockBrowser.newContext).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessViaGoogle', () => {
    it('Google経由でサイトにアクセスすること', async () => {
      const targetUrl = 'https://example.com';
      const searchQuery = 'example site';

      await service.accessViaGoogle(targetUrl, searchQuery);

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.google.com',
        expect.any(Object),
      );
      expect(mockPage.locator).toHaveBeenCalledWith('input[name="q"]');
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });
  });

  describe('getAdaptiveDelay', () => {
    it('エラー時にディレイを増加させること', () => {
      const domain = 'example.com';

      const delay1 = service.getAdaptiveDelay(domain, false);
      const delay2 = service.getAdaptiveDelay(domain, true);
      const delay3 = service.getAdaptiveDelay(domain, true);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('成功時にディレイを減少させること', () => {
      const domain = 'example.com';

      // エラーでディレイを増加
      service.getAdaptiveDelay(domain, true);
      const delayAfterError = service.getAdaptiveDelay(domain, false);

      // 時間経過をシミュレート（テスト用に短縮）
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);

      const delayAfterSuccess = service.getAdaptiveDelay(domain, false);

      expect(delayAfterSuccess).toBeLessThan(delayAfterError);
    });
  });

  describe('Cookie管理', () => {
    it('Cookieを保存・復元できること', async () => {
      const domain = 'example.com';
      const mockCookies = [{ name: 'test', value: 'value', domain }];

      mockContext.cookies.mockResolvedValue(mockCookies);

      await service.getOrCreateSession(domain);
      await service.saveCookies(domain);
      await service.restoreCookies(domain);

      expect(mockContext.cookies).toHaveBeenCalled();
      expect(mockContext.addCookies).toHaveBeenCalledWith(mockCookies);
    });
  });
});
