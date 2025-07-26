import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar' })
  telegramId: string; // stringで保存（BigInt問題回避）

  @Column({ nullable: true })
  username?: string;

  @Column()
  firstName: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  languageCode?: string;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastActiveAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ヘルパーメソッド
  get fullName(): string {
    return this.lastName 
      ? `${this.firstName} ${this.lastName}`
      : this.firstName;
  }

  // 設定のデフォルト値を含むゲッター
  get notificationSettings(): {
    enabled: boolean;
    silent: boolean;
    schedule?: string;
  } {
    return {
      enabled: true,
      silent: false,
      ...this.settings?.notifications,
    };
  }
}