import { Test, TestingModule } from '@nestjs/testing';
import { UrlService } from './url.service';
import { DatabaseService } from '../../core/database/database.service';
import { Url } from './url.interface';

const mockDatabaseService = {
  query: jest.fn(),
  findOne: jest.fn(),
  execute: jest.fn(),
  transaction: jest.fn(),
};

describe('UrlService', () => {
  let service: UrlService;
  let databaseService: typeof mockDatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<UrlService>(UrlService);
    databaseService = module.get(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('初期データがない場合、テストデータを登録すること', async () => {
      databaseService.findOne.mockReturnValue(undefined);
      databaseService.execute.mockReturnValue({
        changes: 1,
        lastInsertRowid: 1,
      });

      await service.onModuleInit();

      expect(databaseService.findOne).toHaveBeenCalledWith(
        'SELECT * FROM urls WHERE url = ?',
        [expect.stringContaining('athome.co.jp')],
      );
      expect(databaseService.execute).toHaveBeenCalledWith(
        'INSERT INTO urls (name, url, selector, is_active) VALUES (?, ?, ?, ?)',
        [
          '広島県のテスト物件',
          expect.stringContaining('athome.co.jp'),
          '#item-list',
          1,
        ],
      );
    });

    it('初期データが既に存在する場合、新たに登録しないこと', async () => {
      databaseService.findOne.mockReturnValue({ id: 1 });

      await service.onModuleInit();

      expect(databaseService.findOne).toHaveBeenCalled();
      expect(databaseService.execute).not.toHaveBeenCalled();
    });
  });

  describe('findAllActive', () => {
    it('アクティブなURLの配列を返すこと', async () => {
      const activeUrls: Url[] = [
        {
          id: 1,
          name: 'URL1',
          url: 'http://example1.com',
          selector: '#test',
          contentHash: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'URL2',
          url: 'http://example2.com',
          selector: '#test',
          contentHash: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      databaseService.query.mockResolvedValue(activeUrls);

      const result = await service.findAllActive();

      expect(result).toEqual(activeUrls);
      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM urls WHERE is_active = ?',
        [1],
      );
    });

    it('アクティブなURLが存在しない場合、空の配列を返すこと', async () => {
      databaseService.query.mockResolvedValue([]);

      const result = await service.findAllActive();

      expect(result).toEqual([]);
      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM urls WHERE is_active = ?',
        [1],
      );
    });
  });

  describe('updateHash', () => {
    it('指定したIDのURLのハッシュを更新すること', async () => {
      const updateResult = { changes: 1, lastInsertRowid: 0 };
      databaseService.execute.mockReturnValue(updateResult);

      const result = await service.updateHash(1, 'newhash123');

      expect(result).toEqual(updateResult);
      expect(databaseService.execute).toHaveBeenCalledWith(
        'UPDATE urls SET content_hash = ? WHERE id = ?',
        ['newhash123', 1],
      );
    });

    it('存在しないIDの場合でも更新を実行すること（現在の実装）', async () => {
      const updateResult = { changes: 0, lastInsertRowid: 0 };
      databaseService.execute.mockReturnValue(updateResult);

      const result = await service.updateHash(999, 'newhash123');

      expect(result).toEqual(updateResult);
      expect(databaseService.execute).toHaveBeenCalledWith(
        'UPDATE urls SET content_hash = ? WHERE id = ?',
        ['newhash123', 999],
      );
    });
  });
});
