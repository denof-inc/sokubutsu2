import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import type { UserUrl } from './UserUrl.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  telegramChatId!: string;

  @Column({ nullable: true })
  telegramUsername?: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  registeredAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany('UserUrl', 'user')
  urls!: Relation<UserUrl[]>;

  // ビジネスロジック
  canAddUrl(): boolean {
    const activeUrls = this.urls?.filter(url => url.isActive) || [];
    return activeUrls.length < 3; // RFP要件: 1-3件制限
  }

  getUrlsByPrefecture(prefecture: string): UserUrl[] {
    return this.urls?.filter(url => url.prefecture === prefecture && url.isActive) || [];
  }

  canAddUrlInPrefecture(prefecture: string): boolean {
    const prefectureUrls = this.getUrlsByPrefecture(prefecture);
    return prefectureUrls.length === 0; // RFP要件: 都道府県単位で1つまで
  }
}
