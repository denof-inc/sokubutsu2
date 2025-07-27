import { Test, TestingModule } from '@nestjs/testing';
import { ScrapingService } from './scraping.service';
import { BotProtectionService } from '../bot-protection/bot-protection.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';

jest.mock('axios');
jest.mock('cheerio');
jest.mock('jsdom');
jest.mock('playwright');

describe('ScrapingService', () => {
  let service: ScrapingService;
  const mockUrl = 'https://example.com';
  const mockSelector = '#test-selector';
  const mockContent = '<div>Test Content</div>';
  const _mockHash = 'mocked-hash';

  const mockBotProtectionService = {
    detectBot: jest.fn(),
    bypassProtection: jest.fn(),
    getAdaptiveDelay: jest.fn().mockReturnValue(100),
    analyzeBotProtection: jest.fn().mockResolvedValue({
      isProtected: false,
      protectionLevel: 'none',
      methods: [],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapingService,
        {
          provide: BotProtectionService,
          useValue: mockBotProtectionService,
        },
      ],
    }).compile();

    service = module.get<ScrapingService>(ScrapingService);

    // クリーンアップ
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scrapeAndGetHash', () => {
    it('HTTP + Cheerioで成功する場合', async () => {
      // Axiosのモック
      (axios.get as jest.Mock).mockResolvedValue({
        data: '<html><body><div id="test-selector">Test Content</div></body></html>',
      });

      // Cheerioのモック
      const mockElement = {
        html: jest.fn().mockReturnValue(mockContent),
        length: 1,
      };
      const mockCheerio = {
        load: jest.fn().mockReturnValue(jest.fn().mockReturnValue(mockElement)),
      };
      (cheerio as unknown as { load: jest.Mock }).load = mockCheerio.load;

      const result = await service.scrapeAndGetHash(mockUrl, mockSelector);

      expect(result).toBeDefined();
      expect(axios.get).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
          }),
        }),
      );
    });

    it('HTTP失敗時はJSDOMにフォールバック', async () => {
      // Axiosを失敗させる
      (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      // JSDOMのモック
      const mockElement = { innerHTML: mockContent };
      const mockDocument = {
        querySelector: jest.fn().mockReturnValue(mockElement),
      };
      const mockWindow = { document: mockDocument, close: jest.fn() };
      (JSDOM.fromURL as jest.Mock).mockResolvedValue({ window: mockWindow });

      const result = await service.scrapeAndGetHash(mockUrl, mockSelector);

      expect(result).toBeDefined();
      expect(JSDOM.fromURL).toHaveBeenCalled();
    });

    it('すべての手法が失敗した場合はnullを返す', async () => {
      // すべて失敗させる
      (axios.get as jest.Mock).mockRejectedValue(new Error('HTTP failed'));
      (JSDOM.fromURL as jest.Mock).mockRejectedValue(new Error('JSDOM failed'));

      const mockBrowser = {
        newPage: jest.fn().mockRejectedValue(new Error('Playwright failed')),
        close: jest.fn(),
      };
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

      const result = await service.scrapeAndGetHash(mockUrl, mockSelector);

      expect(result).toBeNull();
    });
  });
});
