import { Test, TestingModule } from '@nestjs/testing';
import { TelegramController } from './telegram.controller';
import { AuthService } from '../../core/auth/auth.service';
import { TelegramService } from './telegram.service';
import { User } from '../users/entities/user.entity';
import {
  TelegramUpdate,
  TelegramUser,
} from '../../common/interfaces/telegram-user.interface';
import { TelegramWebhookGuard } from '../../common/guards/telegram-webhook.guard';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

describe('TelegramController', () => {
  let controller: TelegramController;
  let authService: jest.Mocked<AuthService>;
  let telegramService: jest.Mocked<TelegramService>;

  const mockUser: User = {
    id: 1,
    telegramId: '123456789',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    isActive: true,
    languageCode: 'ja',
    settings: {
      notifications: { enabled: true, silent: false },
      language: 'ja',
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    fullName: 'Test User',
    displayName: 'testuser',
  };

  const mockTelegramUser: TelegramUser = {
    id: 123456789,
    is_bot: false,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'ja',
  };

  const mockUpdate: TelegramUpdate = {
    update_id: 1,
    message: {
      message_id: 1,
      date: Date.now(),
      chat: {
        id: 123456789,
        type: 'private',
      },
      from: mockTelegramUser,
      text: '/start',
    },
  };

  beforeEach(async () => {
    const mockAuthService = {
      handleStartCommand: jest.fn(),
    };

    const mockTelegramService = {
      sendMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: TelegramService, useValue: mockTelegramService },
      ],
    })
      .overrideGuard(TelegramWebhookGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TelegramAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TelegramController>(TelegramController);
    authService = module.get(AuthService);
    telegramService = module.get(TelegramService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleUpdate', () => {
    it('should handle /start command', async () => {
      authService.handleStartCommand.mockResolvedValue({
        user: mockUser,
        isNewUser: true,
        welcomeMessage: 'はじめまして！',
      });

      const result = await controller.handleUpdate(
        mockUpdate,
        mockUser,
        mockTelegramUser,
        true,
      );

      expect(result).toEqual({ ok: true });
      expect(authService.handleStartCommand).toHaveBeenCalledWith(
        mockTelegramUser,
      );
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        'はじめまして！',
      );
    });

    it('should handle /add command without URL', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: '/add',
        },
      } as TelegramUpdate;

      await controller.handleUpdate(update, mockUser, mockTelegramUser, false);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining('使用方法: /add <URL>'),
      );
    });

    it('should handle /add command with invalid URL', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: '/add invalid-url',
        },
      } as TelegramUpdate;

      await controller.handleUpdate(update, mockUser, mockTelegramUser, false);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        '有効なURLを入力してください。',
      );
    });

    it('should handle /add command with valid URL', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: '/add https://example.com',
        },
      } as TelegramUpdate;

      await controller.handleUpdate(update, mockUser, mockTelegramUser, false);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining('監視リストに追加しました'),
      );
    });

    it('should handle /list command', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: '/list',
        },
      } as TelegramUpdate;

      await controller.handleUpdate(update, mockUser, mockTelegramUser, false);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining('監視中のURL一覧'),
      );
    });

    it('should handle /help command', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: '/help',
        },
      } as TelegramUpdate;

      await controller.handleUpdate(update, mockUser, mockTelegramUser, false);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining('コマンド一覧'),
      );
    });

    it('should handle unknown command', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: '/unknown',
        },
      } as TelegramUpdate;

      await controller.handleUpdate(update, mockUser, mockTelegramUser, false);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        '不明なコマンドです。/help でコマンド一覧を確認してください。',
      );
    });

    it('should ignore non-text updates', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: undefined,
        },
      } as TelegramUpdate;

      const result = await controller.handleUpdate(
        update,
        mockUser,
        mockTelegramUser,
        false,
      );

      expect(result).toEqual({ ok: true });
      expect(telegramService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      authService.handleStartCommand.mockRejectedValue(new Error('Test error'));

      await controller.handleUpdate(
        mockUpdate,
        mockUser,
        mockTelegramUser,
        true,
      );

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        'エラーが発生しました。しばらく待ってから再度お試しください。',
      );
    });

    it('should handle /status command', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: '/status',
        },
      } as TelegramUpdate;

      await controller.handleUpdate(update, mockUser, mockTelegramUser, false);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining('監視状況'),
      );
    });

    it('should handle /remove command without index', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: '/remove',
        },
      } as TelegramUpdate;

      await controller.handleUpdate(update, mockUser, mockTelegramUser, false);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining('使用方法: /remove <番号>'),
      );
    });

    it('should handle /pause command with valid index', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: '/pause 1',
        },
      } as TelegramUpdate;

      await controller.handleUpdate(update, mockUser, mockTelegramUser, false);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining('監視を一時停止しました'),
      );
    });

    it('should handle /resume command with invalid index', async () => {
      const update = {
        ...mockUpdate,
        message: {
          ...(mockUpdate.message || {}),
          text: '/resume abc',
        },
      } as TelegramUpdate;

      await controller.handleUpdate(update, mockUser, mockTelegramUser, false);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        123456789,
        '番号を正しく入力してください。',
      );
    });
  });
});
