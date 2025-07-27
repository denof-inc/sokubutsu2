import { Test, TestingModule } from '@nestjs/testing';
import { TaskSchedulerService } from './task-scheduler.service';
import { UrlService } from '../../domain/url/url.service';
import { ScrapingService } from '../scraping/scraping.service';
import { NotificationService } from '../notification/notification.service';

describe('TaskSchedulerService', () => {
  let service: TaskSchedulerService;

  const mockUrlService = {
    findAllActive: jest.fn().mockResolvedValue([]),
    updateHash: jest.fn(),
  };

  const mockScrapingService = {
    scrapeAndGetHash: jest.fn().mockResolvedValue('mocked-hash'),
  };

  const mockNotificationService = {
    sendNotification: jest.fn(),
    notifyUrlChanged: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskSchedulerService,
        {
          provide: UrlService,
          useValue: mockUrlService,
        },
        {
          provide: ScrapingService,
          useValue: mockScrapingService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<TaskSchedulerService>(TaskSchedulerService);

    // クリーンアップ
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
