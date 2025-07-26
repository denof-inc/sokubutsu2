import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface UserSettings {
  notifications: {
    enabled: boolean;
    silent: boolean;
    timeRange?: {
      start: string; // HH:mm format
      end: string;   // HH:mm format
    };
  };
  language: string;
  timezone?: string;
}

@Entity('users')
@Index(['telegramId'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint', unique: true })
  telegramId: string;

  @Column({ nullable: true, length: 255 })
  username?: string;

  @Column({ length: 255 })
  firstName: string;

  @Column({ nullable: true, length: 255 })
  lastName?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, length: 10 })
  languageCode?: string;

  @Column({ type: 'json', nullable: true })
  settings?: UserSettings;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastActiveAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ゲッター
  get fullName(): string {
    return this.lastName 
      ? `${this.firstName} ${this.lastName}` 
      : this.firstName;
  }

  get displayName(): string {
    return this.username || this.fullName;
  }
}