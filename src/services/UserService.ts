import { Repository } from 'typeorm';
import { User } from '../entities/User.js';
import { UserUrl } from '../entities/UserUrl.js';
import { AppDataSource } from '../database/connection.js';
import { vibeLogger } from '../logger.js';

export class UserService {
  private readonly userRepository: Repository<User>;
  private readonly urlRepository: Repository<UserUrl>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.urlRepository = AppDataSource.getRepository(UserUrl);
  }

  /**
   * ユーザー登録または取得
   */
  async registerOrGetUser(telegramChatId: string, telegramUsername?: string): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { telegramChatId },
      relations: ['urls'],
    });

    if (!user) {
      const newUser = new User();
      newUser.telegramChatId = telegramChatId;
      if (telegramUsername) {
        newUser.telegramUsername = telegramUsername;
      }
      newUser.isActive = true;
      user = await this.userRepository.save(newUser);

      vibeLogger.info('user.registered', 'ユーザー登録完了', {
        context: { userId: user.id, telegramChatId, telegramUsername },
        humanNote: '新規ユーザーがサービスに登録しました',
      });
    }

    return user;
  }

  /**
   * URL登録
   */
  async registerUrl(
    userId: string,
    url: string,
    name: string,
    prefecture: string
  ): Promise<{ success: boolean; message: string; userUrl?: UserUrl }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['urls'],
    });

    if (!user) {
      return { success: false, message: 'ユーザーが見つかりません' };
    }

    // RFP要件チェック: URL数制限
    if (!user.canAddUrl()) {
      return { success: false, message: '登録可能URL数の上限（3件）に達しています' };
    }

    // RFP要件チェック: 都道府県制限
    if (!user.canAddUrlInPrefecture(prefecture)) {
      return {
        success: false,
        message: `${prefecture}では既にURLが登録されています（1都道府県1URLまで）`,
      };
    }

    // URL重複チェック
    const existingUrl = await this.urlRepository.findOne({
      where: { userId, url, isActive: true },
    });

    if (existingUrl) {
      return { success: false, message: '同じURLが既に登録されています' };
    }

    const userUrl = this.urlRepository.create({
      userId,
      url,
      name,
      prefecture,
      isActive: true,
      isMonitoring: true,
    });

    await this.urlRepository.save(userUrl);

    vibeLogger.info('user.url_registered', 'URL登録完了', {
      context: { userId, urlId: userUrl.id, url, name, prefecture },
      humanNote: 'ユーザーが新しい監視URLを登録しました',
    });

    return { success: true, message: 'URL登録が完了しました', userUrl };
  }

  /**
   * ユーザーのURL一覧取得
   */
  async getUserUrls(userId: string): Promise<UserUrl[]> {
    return this.urlRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * URL監視状態変更（一時停止・再開）
   */
  async toggleUrlMonitoring(
    userId: string,
    urlId: string
  ): Promise<{ success: boolean; message: string; isMonitoring?: boolean }> {
    const userUrl = await this.urlRepository.findOne({
      where: { id: urlId, userId, isActive: true },
    });

    if (!userUrl) {
      return { success: false, message: 'URLが見つかりません' };
    }

    userUrl.isMonitoring = !userUrl.isMonitoring;
    await this.urlRepository.save(userUrl);

    const status = userUrl.isMonitoring ? '再開' : '一時停止';
    vibeLogger.info('user.url_toggle', `URL監視${status}`, {
      context: { userId, urlId, isMonitoring: userUrl.isMonitoring },
    });

    return {
      success: true,
      message: `「${userUrl.name}」の監視を${status}しました`,
      isMonitoring: userUrl.isMonitoring,
    };
  }

  /**
   * URL削除
   */
  async deleteUrl(userId: string, urlId: string): Promise<{ success: boolean; message: string }> {
    const userUrl = await this.urlRepository.findOne({
      where: { id: urlId, userId, isActive: true },
    });

    if (!userUrl) {
      return { success: false, message: 'URLが見つかりません' };
    }

    userUrl.isActive = false;
    await this.urlRepository.save(userUrl);

    vibeLogger.info('user.url_deleted', 'URL削除完了', {
      context: { userId, urlId, name: userUrl.name },
    });

    return { success: true, message: `「${userUrl.name}」を削除しました` };
  }

  /**
   * 全ユーザーの監視対象URL取得（監視システム用）
   */
  async getAllActiveMonitoringUrls(): Promise<UserUrl[]> {
    return this.urlRepository.find({
      where: { isActive: true, isMonitoring: true },
      relations: ['user'],
    });
  }

  /**
   * ユーザーIDでユーザー取得
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
      relations: ['urls'],
    });
  }

  /**
   * 管理者用: 全ユーザー取得
   */
  async getAllUsers(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['urls'],
      order: { registeredAt: 'DESC' },
    });
  }

  /**
   * 管理者用: ユーザー無効化
   */
  async deactivateUser(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, message: 'ユーザーが見つかりません' };
    }

    user.isActive = false;
    await this.userRepository.save(user);

    vibeLogger.info('admin.user_deactivated', 'ユーザー無効化', {
      context: { userId },
      humanNote: '管理者がユーザーを無効化しました',
    });

    return { success: true, message: 'ユーザーを無効化しました' };
  }

  /**
   * 管理者用: URL削除
   */
  async adminDeleteUrl(urlId: string): Promise<{ success: boolean; message: string }> {
    const userUrl = await this.urlRepository.findOne({
      where: { id: urlId },
    });

    if (!userUrl) {
      return { success: false, message: 'URLが見つかりません' };
    }

    userUrl.isActive = false;
    await this.urlRepository.save(userUrl);

    vibeLogger.info('admin.url_deleted', '管理者によるURL削除', {
      context: { urlId },
      humanNote: '管理者がURLを削除しました',
    });

    return { success: true, message: 'URLを削除しました' };
  }
}
