import { User } from '../../entities/User.js';
import { UserUrl } from '../../entities/UserUrl.js';

describe('User Entity', () => {
  let user: User;

  beforeEach(() => {
    user = new User();
    user.id = 'user-123';
    user.telegramChatId = 'chat-123';
    user.telegramUsername = 'testuser';
    user.isActive = true;
    user.registeredAt = new Date('2024-01-01');
    user.updatedAt = new Date('2024-01-02');
    user.urls = [];
  });

  describe('canAddUrl', () => {
    it('URLが3件未満の場合はtrueを返すこと', () => {
      // 0件
      expect(user.canAddUrl()).toBe(true);

      // 1件追加
      const url1 = new UserUrl();
      url1.isActive = true;
      user.urls = [url1];
      expect(user.canAddUrl()).toBe(true);

      // 2件追加
      const url2 = new UserUrl();
      url2.isActive = true;
      user.urls = [url1, url2];
      expect(user.canAddUrl()).toBe(true);
    });

    it('URLが3件の場合はfalseを返すこと', () => {
      const url1 = new UserUrl();
      url1.isActive = true;
      const url2 = new UserUrl();
      url2.isActive = true;
      const url3 = new UserUrl();
      url3.isActive = true;

      user.urls = [url1, url2, url3];
      expect(user.canAddUrl()).toBe(false);
    });

    it('非アクティブなURLは数に含めないこと', () => {
      const url1 = new UserUrl();
      url1.isActive = true;
      const url2 = new UserUrl();
      url2.isActive = false; // 非アクティブ
      const url3 = new UserUrl();
      url3.isActive = true;

      user.urls = [url1, url2, url3];
      expect(user.canAddUrl()).toBe(true); // アクティブは2件のみ
    });

    it('urlsがundefinedの場合も正常に動作すること', () => {
      user.urls = undefined as any;
      expect(user.canAddUrl()).toBe(true);
    });
  });

  describe('getUrlsByPrefecture', () => {
    it('指定された都道府県のURLを返すこと', () => {
      const url1 = new UserUrl();
      url1.prefecture = '東京都';
      url1.isActive = true;

      const url2 = new UserUrl();
      url2.prefecture = '大阪府';
      url2.isActive = true;

      const url3 = new UserUrl();
      url3.prefecture = '東京都';
      url3.isActive = true;

      user.urls = [url1, url2, url3];

      const tokyoUrls = user.getUrlsByPrefecture('東京都');
      expect(tokyoUrls).toHaveLength(2);
      expect(tokyoUrls).toContain(url1);
      expect(tokyoUrls).toContain(url3);
    });

    it('非アクティブなURLは除外すること', () => {
      const url1 = new UserUrl();
      url1.prefecture = '東京都';
      url1.isActive = true;

      const url2 = new UserUrl();
      url2.prefecture = '東京都';
      url2.isActive = false; // 非アクティブ

      user.urls = [url1, url2];

      const tokyoUrls = user.getUrlsByPrefecture('東京都');
      expect(tokyoUrls).toHaveLength(1);
      expect(tokyoUrls).toContain(url1);
    });

    it('該当する都道府県がない場合は空配列を返すこと', () => {
      const url1 = new UserUrl();
      url1.prefecture = '東京都';
      url1.isActive = true;

      user.urls = [url1];

      const osakaUrls = user.getUrlsByPrefecture('大阪府');
      expect(osakaUrls).toHaveLength(0);
    });

    it('urlsがundefinedの場合も正常に動作すること', () => {
      user.urls = undefined as any;
      const result = user.getUrlsByPrefecture('東京都');
      expect(result).toEqual([]);
    });
  });

  describe('canAddUrlInPrefecture', () => {
    it('その都道府県にURLがない場合はtrueを返すこと', () => {
      const url1 = new UserUrl();
      url1.prefecture = '東京都';
      url1.isActive = true;

      user.urls = [url1];

      expect(user.canAddUrlInPrefecture('大阪府')).toBe(true);
    });

    it('その都道府県に既にURLがある場合はfalseを返すこと', () => {
      const url1 = new UserUrl();
      url1.prefecture = '東京都';
      url1.isActive = true;

      user.urls = [url1];

      expect(user.canAddUrlInPrefecture('東京都')).toBe(false);
    });

    it('非アクティブなURLしかない場合はtrueを返すこと', () => {
      const url1 = new UserUrl();
      url1.prefecture = '東京都';
      url1.isActive = false; // 非アクティブ

      user.urls = [url1];

      expect(user.canAddUrlInPrefecture('東京都')).toBe(true);
    });

    it('urlsがundefinedの場合も正常に動作すること', () => {
      user.urls = undefined as any;
      expect(user.canAddUrlInPrefecture('東京都')).toBe(true);
    });
  });

  describe('Entity properties', () => {
    it('全てのプロパティが正しく設定されること', () => {
      expect(user.id).toBe('user-123');
      expect(user.telegramChatId).toBe('chat-123');
      expect(user.telegramUsername).toBe('testuser');
      expect(user.isActive).toBe(true);
      expect(user.registeredAt).toEqual(new Date('2024-01-01'));
      expect(user.updatedAt).toEqual(new Date('2024-01-02'));
      expect(user.urls).toEqual([]);
    });

    it('デフォルト値が正しく設定されること', () => {
      const newUser = new User();
      
      // TypeORMが実際には設定するが、テストでは未定義
      expect(newUser.id).toBeUndefined();
      expect(newUser.telegramChatId).toBeUndefined();
      expect(newUser.telegramUsername).toBeUndefined();
      expect(newUser.isActive).toBeUndefined();
      expect(newUser.urls).toBeUndefined();
    });
  });

  describe('Business logic validation', () => {
    it('RFP要件: 最大3件のURL制限が機能すること', () => {
      // 3件まで追加可能
      for (let i = 0; i < 3; i++) {
        const url = new UserUrl();
        url.isActive = true;
        user.urls?.push(url);
      }
      
      expect(user.canAddUrl()).toBe(false);
      expect(user.urls).toHaveLength(3);
    });

    it('RFP要件: 1都道府県1URL制限が機能すること', () => {
      const url1 = new UserUrl();
      url1.prefecture = '東京都';
      url1.isActive = true;
      user.urls = [url1];

      // 東京都には追加不可
      expect(user.canAddUrlInPrefecture('東京都')).toBe(false);
      
      // 他の都道府県には追加可能
      expect(user.canAddUrlInPrefecture('神奈川県')).toBe(true);
      expect(user.canAddUrlInPrefecture('千葉県')).toBe(true);
    });

    it('複数の都道府県にURLを持てること', () => {
      const url1 = new UserUrl();
      url1.prefecture = '東京都';
      url1.isActive = true;

      const url2 = new UserUrl();
      url2.prefecture = '神奈川県';
      url2.isActive = true;

      const url3 = new UserUrl();
      url3.prefecture = '千葉県';
      url3.isActive = true;

      user.urls = [url1, url2, url3];

      // 3つの異なる都道府県にURL
      expect(user.canAddUrl()).toBe(false); // 3件制限
      expect(user.canAddUrlInPrefecture('東京都')).toBe(false);
      expect(user.canAddUrlInPrefecture('神奈川県')).toBe(false);
      expect(user.canAddUrlInPrefecture('千葉県')).toBe(false);
      expect(user.canAddUrlInPrefecture('埼玉県')).toBe(true); // 新しい都道府県だが、3件制限で追加不可
    });
  });
});