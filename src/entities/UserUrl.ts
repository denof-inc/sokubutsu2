import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  type Relation,
} from 'typeorm';
import type { User } from './User.js';

@Entity('user_urls')
export class UserUrl {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('text')
  url!: string;

  @Column('text')
  name!: string;

  @Column('text')
  prefecture!: string;

  @Column('boolean', { default: true })
  isActive!: boolean;

  @Column('boolean', { default: true })
  isMonitoring!: boolean; // 一時停止・再開用

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column('text')
  userId!: string;

  @ManyToOne('User', 'urls')
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  // 最後の監視結果
  @Column('text', { nullable: true })
  lastHash?: string;

  @Column('datetime', { nullable: true })
  lastCheckedAt?: Date;

  @Column('int', { default: 0 })
  newListingsCount!: number;

  @Column('int', { default: 0 })
  totalChecks!: number;

  @Column('int', { default: 0 })
  errorCount!: number;
}
