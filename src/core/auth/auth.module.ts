import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../../domain/users/users.module';

@Module({
  imports: [UsersModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}