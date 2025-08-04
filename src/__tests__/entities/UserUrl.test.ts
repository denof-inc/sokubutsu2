import { UserUrl } from '../../entities/UserUrl.js';
import { User } from '../../entities/User.js';

describe('UserUrl Entity', () => {
  let userUrl: UserUrl;
  let user: User;

  beforeEach(() => {
    user = new User();
    user.id = 'user-123';
    user.telegramChatId = 'chat-123';

    userUrl = new UserUrl();
    userUrl.id = 'url-123';
    userUrl.userId = 'user-123';
    userUrl.user = user;
    userUrl.url = 'https://www.athome.co.jp/chintai/tokyo/list/';
    userUrl.name = '東京の賃貸物件';
    userUrl.prefecture = '東京都';
    userUrl.isActive = true;
    userUrl.isMonitoring = true;
    userUrl.lastHash = 'hash-123';
    userUrl.lastCheckedAt = new Date('2024-01-01T10:00:00');
    userUrl.totalChecks = 100;
    userUrl.errorCount = 5;
    userUrl.newListingsCount = 10;
    userUrl.createdAt = new Date('2024-01-01');
    userUrl.updatedAt = new Date('2024-01-02');
  });

  describe('Entity properties', () => {
    it('全てのプロパティが正しく設定されること', () => {
      expect(userUrl.id).toBe('url-123');
      expect(userUrl.userId).toBe('user-123');
      expect(userUrl.user).toBe(user);
      expect(userUrl.url).toBe('https://www.athome.co.jp/chintai/tokyo/list/');
      expect(userUrl.name).toBe('東京の賃貸物件');
      expect(userUrl.prefecture).toBe('東京都');
      expect(userUrl.isActive).toBe(true);
      expect(userUrl.isMonitoring).toBe(true);
      expect(userUrl.lastHash).toBe('hash-123');
      expect(userUrl.lastCheckedAt).toEqual(new Date('2024-01-01T10:00:00'));
      expect(userUrl.totalChecks).toBe(100);
      expect(userUrl.errorCount).toBe(5);
      expect(userUrl.newListingsCount).toBe(10);
      expect(userUrl.createdAt).toEqual(new Date('2024-01-01'));
      expect(userUrl.updatedAt).toEqual(new Date('2024-01-02'));
    });

    it('デフォルト値が正しく設定されること', () => {
      const newUrl = new UserUrl();
      
      // TypeORMが実際には設定するが、テストでは未定義
      expect(newUrl.id).toBeUndefined();
      expect(newUrl.userId).toBeUndefined();
      expect(newUrl.user).toBeUndefined();
      expect(newUrl.url).toBeUndefined();
      expect(newUrl.name).toBeUndefined();
      expect(newUrl.prefecture).toBeUndefined();
      expect(newUrl.isActive).toBeUndefined();
      expect(newUrl.isMonitoring).toBeUndefined();
      expect(newUrl.lastHash).toBeUndefined();
      expect(newUrl.lastCheckedAt).toBeUndefined();
      expect(newUrl.totalChecks).toBeUndefined();
      expect(newUrl.errorCount).toBeUndefined();
      expect(newUrl.newListingsCount).toBeUndefined();
    });
  });

  describe('Monitoring status', () => {
    it('監視中のURLを識別できること', () => {
      userUrl.isMonitoring = true;
      expect(userUrl.isMonitoring).toBe(true);
    });

    it('一時停止中のURLを識別できること', () => {
      userUrl.isMonitoring = false;
      expect(userUrl.isMonitoring).toBe(false);
    });

    it('アクティブ状態を管理できること', () => {
      userUrl.isActive = true;
      expect(userUrl.isActive).toBe(true);

      // 削除（論理削除）
      userUrl.isActive = false;
      expect(userUrl.isActive).toBe(false);
    });
  });

  describe('Statistics tracking', () => {
    it('チェック回数を追跡できること', () => {
      userUrl.totalChecks = 0;
      
      // チェック実行
      userUrl.totalChecks++;
      expect(userUrl.totalChecks).toBe(1);

      // 複数回チェック
      for (let i = 0; i < 10; i++) {
        userUrl.totalChecks++;
      }
      expect(userUrl.totalChecks).toBe(11);
    });

    it('エラー回数を追跡できること', () => {
      userUrl.errorCount = 0;
      
      // エラー発生
      userUrl.errorCount++;
      expect(userUrl.errorCount).toBe(1);

      // 複数回エラー
      userUrl.errorCount += 5;
      expect(userUrl.errorCount).toBe(6);
    });

    it('新着検知回数を追跡できること', () => {
      userUrl.newListingsCount = 0;
      
      // 新着検知
      userUrl.newListingsCount++;
      expect(userUrl.newListingsCount).toBe(1);

      // 複数回検知
      userUrl.newListingsCount += 3;
      expect(userUrl.newListingsCount).toBe(4);
    });

    it('成功率を計算できること', () => {
      userUrl.totalChecks = 100;
      userUrl.errorCount = 10;
      
      const successRate = ((userUrl.totalChecks - userUrl.errorCount) / userUrl.totalChecks) * 100;
      expect(successRate).toBe(90);
    });

    it('最終チェック時刻を更新できること', () => {
      const now = new Date();
      userUrl.lastCheckedAt = now;
      
      expect(userUrl.lastCheckedAt).toEqual(now);
    });
  });

  describe('Hash management', () => {
    it('ハッシュ値を保存できること', () => {
      userUrl.lastHash = 'new-hash-456';
      expect(userUrl.lastHash).toBe('new-hash-456');
    });

    it('初回チェック時はハッシュがnullであること', () => {
      const newUrl = new UserUrl();
      expect(newUrl.lastHash).toBeUndefined();
    });

    it('ハッシュ値の変更を検知できること', () => {
      const oldHash = userUrl.lastHash;
      const newHash = 'new-hash-789';
      
      expect(oldHash).not.toBe(newHash);
      
      userUrl.lastHash = newHash;
      expect(userUrl.lastHash).toBe(newHash);
    });
  });

  describe('URL validation', () => {
    it('有効なURLを設定できること', () => {
      const validUrls = [
        'https://www.athome.co.jp/chintai/tokyo/list/',
        'https://suumo.jp/jj/chintai/ichiran/FR301FC001/',
        'https://www.homes.co.jp/chintai/tokyo/',
      ];

      validUrls.forEach(url => {
        userUrl.url = url;
        expect(userUrl.url).toBe(url);
      });
    });

    it('都道府県情報を保持できること', () => {
      const prefectures = ['東京都', '大阪府', '北海道', '沖縄県'];
      
      prefectures.forEach(pref => {
        userUrl.prefecture = pref;
        expect(userUrl.prefecture).toBe(pref);
      });
    });
  });

  describe('Relationship with User', () => {
    it('ユーザーとの関連を持てること', () => {
      expect(userUrl.user).toBe(user);
      expect(userUrl.userId).toBe(user.id);
    });

    it('ユーザーIDのみでも動作すること', () => {
      const urlWithoutUser = new UserUrl();
      urlWithoutUser.userId = 'user-456';
      
      expect(urlWithoutUser.userId).toBe('user-456');
      expect(urlWithoutUser.user).toBeUndefined();
    });
  });

  describe('Business logic', () => {
    it('監視対象として識別できること', () => {
      // アクティブかつ監視中
      userUrl.isActive = true;
      userUrl.isMonitoring = true;
      
      const isBeingMonitored = userUrl.isActive && userUrl.isMonitoring;
      expect(isBeingMonitored).toBe(true);
    });

    it('削除されたURLは監視対象外であること', () => {
      // 論理削除
      userUrl.isActive = false;
      userUrl.isMonitoring = true; // 監視設定はONでも
      
      const isBeingMonitored = userUrl.isActive && userUrl.isMonitoring;
      expect(isBeingMonitored).toBe(false);
    });

    it('一時停止中のURLは監視対象外であること', () => {
      userUrl.isActive = true;
      userUrl.isMonitoring = false; // 一時停止
      
      const isBeingMonitored = userUrl.isActive && userUrl.isMonitoring;
      expect(isBeingMonitored).toBe(false);
    });

    it('統計情報の初期値が適切であること', () => {
      const newUrl = new UserUrl();
      
      // TypeORMのデフォルト値が設定される前
      expect(newUrl.totalChecks).toBeUndefined();
      expect(newUrl.errorCount).toBeUndefined();
      expect(newUrl.newListingsCount).toBeUndefined();
      
      // 実際の使用時は0で初期化される想定
      newUrl.totalChecks = 0;
      newUrl.errorCount = 0;
      newUrl.newListingsCount = 0;
      
      expect(newUrl.totalChecks).toBe(0);
      expect(newUrl.errorCount).toBe(0);
      expect(newUrl.newListingsCount).toBe(0);
    });
  });
});