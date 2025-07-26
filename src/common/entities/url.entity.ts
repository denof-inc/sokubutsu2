import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('urls')
export class Url {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 2048 })
  url: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lastContentHash?: string;

  @Column({ type: 'datetime', nullable: true })
  lastCheckedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  lastNotifiedAt?: Date;

  @Column({ type: 'integer', default: 0 })
  checkCount: number;

  @Column({ type: 'integer', default: 0 })
  notificationCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.urls)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;
}
