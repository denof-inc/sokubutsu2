import express, {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { UserService } from '../services/UserService.js';
import { vibeLogger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AdminServer {
  private readonly app: express.Application;
  private readonly userService: UserService;

  constructor() {
    this.app = express();
    this.userService = new UserService();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static('public'));
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, 'views'));
  }

  private setupRoutes(): void {
    // ヘルスチェック用エンドポイント
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // ダッシュボード
    this.app.get('/', async (req, res) => {
      try {
        const users = await this.userService.getAllUsers();
        const stats = {
          totalUsers: users.length,
          activeUsers: users.filter(u => u.isActive).length,
          totalUrls: users.reduce((sum, u) => sum + u.urls.filter(url => url.isActive).length, 0),
          monitoringUrls: users.reduce(
            (sum, u) => sum + u.urls.filter(url => url.isActive && url.isMonitoring).length,
            0
          ),
        };

        res.render('dashboard', { users, stats });
      } catch (error) {
        vibeLogger.error('admin.dashboard.error', 'ダッシュボード表示エラー', {
          context: { error },
        });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // ユーザー一覧API
    this.app.get('/api/users', async (req, res) => {
      try {
        const users = await this.userService.getAllUsers();
        res.json(users);
      } catch {
        res.status(500).json({ error: 'Failed to fetch users' });
      }
    });

    // ユーザー詳細API
    this.app.get('/api/users/:id', async (req, res) => {
      try {
        const user = await this.userService.getUserById(req.params.id);
        if (!user) {
          res.status(404).json({ error: 'User not found' });
          return;
        }
        res.json(user);
      } catch {
        res.status(500).json({ error: 'Failed to fetch user' });
      }
    });

    // ユーザー無効化API
    this.app.patch('/api/users/:id/deactivate', async (req, res) => {
      try {
        const result = await this.userService.deactivateUser(req.params.id);
        res.json(result);
      } catch {
        res.status(500).json({ error: 'Failed to deactivate user' });
      }
    });

    // URL削除API
    this.app.delete('/api/urls/:id', async (req, res) => {
      try {
        const result = await this.userService.adminDeleteUrl(req.params.id);
        res.json(result);
      } catch {
        res.status(500).json({ error: 'Failed to delete URL' });
      }
    });
  }

  start(port: number): void {
    this.app.listen(port, () => {
      console.log(`🔧 管理者画面: http://localhost:${port}`);
      vibeLogger.info('admin.server_started', '管理者サーバー起動', {
        context: { port },
      });
    });
  }

  // Webhookなど外部からのハンドラ登録用
  registerPost(path: string, handler: RequestHandler): void {
    this.app.post(
      path,
      (req: Request, res: Response, next: NextFunction) => {
        const started = Date.now();
        const ua = req.headers['user-agent'];
        const ip =
          (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
        vibeLogger.info('admin.webhook.request', 'Webhookリクエスト受信', {
          context: {
            method: req.method,
            path: req.path,
            ip,
            ua,
            contentType: req.headers['content-type'],
          },
        });
        res.on('finish', () => {
          vibeLogger.info('admin.webhook.response', 'Webhookレスポンス送信', {
            context: {
              status: res.statusCode,
              durationMs: Date.now() - started,
            },
          });
        });
        next();
      },
      handler,
      (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        vibeLogger.error('admin.webhook.error', 'Webhook処理中にエラー', {
          context: { error: err instanceof Error ? err.message : String(err) },
        });
        // 使っていることを明示して未使用警告を回避
        void _next;
        try {
          res.status(200).end(); // Telegram側の再送を避ける
        } catch (e) {
          vibeLogger.warn('admin.webhook.error.response', 'エラーレスポンス送信に失敗', {
            context: { error: e instanceof Error ? e.message : String(e) },
          });
        }
      }
    );
  }
}
