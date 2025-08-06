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

  @Column()
  url!: string;

  @Column()
  name!: string;

  @Column()
  prefecture!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: true })
  isMonitoring!: boolean; // 一時停止・再開用

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  userId!: string;

  @ManyToOne('User', 'urls')
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  // 最後の監視結果
  @Column({ nullable: true })
  lastHash?: string;

  @Column({ nullable: true })
  lastCheckedAt?: Date;

  @Column({ default: 0 })
  newListingsCount!: number;

  @Column({ default: 0 })
  totalChecks!: number;

  @Column({ default: 0 })
  errorCount!: number;
}
