import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsDate, IsBoolean } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsDate()
  @IsOptional()
  lastActiveAt?: Date;
  
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}