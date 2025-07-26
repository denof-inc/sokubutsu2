import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserSettings } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      // 既存ユーザーチェック
      const existingUser = await this.findByTelegramId(createUserDto.telegramId);
      if (existingUser) {
        throw new ConflictException(`User with Telegram ID ${createUserDto.telegramId} already exists`);
      }

      const user = this.userRepository.create(createUserDto);
      const savedUser = await this.userRepository.save(user);
      
      this.logger.log(`User created: ${savedUser.telegramId}`);
      return savedUser;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      throw error;
    }
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

  async findByTelegramId(telegramId: string): Promise<User | null> {
    try {
      return await this.userRepository.findOne({
        where: { telegramId },
      });
    } catch (error) {
      this.logger.error(`Failed to find user by Telegram ID ${telegramId}: ${error.message}`);
      throw error;
    }
  }

  async update(telegramId: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      const user = await this.findByTelegramId(telegramId);
      if (!user) {
        throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
      }

      Object.assign(user, updateUserDto);
      const updatedUser = await this.userRepository.save(user);
      
      this.logger.log(`User updated: ${updatedUser.telegramId}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Failed to update user ${telegramId}: ${error.message}`, error.stack);
      throw error;
    }
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

  async updateSettings(telegramId: string, settings: Partial<UserSettings>): Promise<User> {
    try {
      const user = await this.findByTelegramId(telegramId);
      if (!user) {
        throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
      }

      user.settings = { ...user.settings, ...settings } as UserSettings;
      const updatedUser = await this.userRepository.save(user);
      
      this.logger.log(`User settings updated: ${telegramId}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Failed to update user settings ${telegramId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deactivate(telegramId: string): Promise<void> {
    try {
      await this.update(telegramId, { isActive: false });
      this.logger.log(`User deactivated: ${telegramId}`);
    } catch (error) {
      this.logger.error(`Failed to deactivate user ${telegramId}: ${error.message}`, error.stack);
      throw error;
    }
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

  async exists(telegramId: string): Promise<boolean> {
    try {
      const count = await this.userRepository.count({
        where: { telegramId },
      });
      return count > 0;
    } catch (error) {
      this.logger.error(`Failed to check user existence ${telegramId}: ${error.message}`);
      return false;
    }
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