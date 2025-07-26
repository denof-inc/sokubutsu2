import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * ユーザーを作成
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create({
      ...createUserDto,
      lastActiveAt: new Date(),
    });
    return this.userRepository.save(user);
  }

  /**
   * 全ユーザーを取得（管理者用）
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      order: {
        lastActiveAt: 'DESC',
      },
    });
  }

  /**
   * アクティブユーザーのみ取得
   */
  async findActiveUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: {
        isActive: true,
      },
      order: {
        lastActiveAt: 'DESC',
      },
    });
  }

  /**
   * Telegram IDでユーザーを検索
   */
  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { telegramId },
    });
  }

  /**
   * ユーザー情報を更新
   */
  async update(telegramId: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findByTelegramId(telegramId);
    
    if (!user) {
      throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
    }

    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  /**
   * 最終アクティブ時刻を更新
   */
  async updateLastActive(telegramId: string): Promise<void> {
    await this.userRepository.update(
      { telegramId },
      { lastActiveAt: new Date() }
    );
  }

  /**
   * ユーザー設定を更新
   */
  async updateSettings(
    telegramId: string,
    settings: Record<string, any>
  ): Promise<User> {
    const user = await this.findByTelegramId(telegramId);
    
    if (!user) {
      throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
    }

    user.settings = {
      ...user.settings,
      ...settings,
    };

    return this.userRepository.save(user);
  }

  /**
   * ユーザーを無効化（削除の代わり）
   */
  async deactivate(telegramId: string): Promise<User> {
    const user = await this.findByTelegramId(telegramId);
    
    if (!user) {
      throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
    }

    user.isActive = false;
    return this.userRepository.save(user);
  }

  /**
   * ユーザーを再有効化
   */
  async activate(telegramId: string): Promise<User> {
    const user = await this.findByTelegramId(telegramId);
    
    if (!user) {
      throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
    }

    user.isActive = true;
    user.lastActiveAt = new Date();
    return this.userRepository.save(user);
  }

  /**
   * ユーザーが存在するかチェック
   */
  async exists(telegramId: string): Promise<boolean> {
    const count = await this.userRepository.count({
      where: { telegramId },
    });
    return count > 0;
  }

  /**
   * ユーザー統計情報を取得（管理者用）
   */
  async getStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    recentlyActiveUsers: number;
  }> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { isActive: true },
    });
    
    // 24時間以内にアクティブだったユーザー
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentlyActiveUsers = await this.userRepository
      .createQueryBuilder('user')
      .where('user.lastActiveAt > :date', { date: oneDayAgo })
      .getCount();

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      recentlyActiveUsers,
    };
  }
}