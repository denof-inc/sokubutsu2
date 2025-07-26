import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsString()
  telegramId: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  languageCode?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsOptional()
  settings?: Record<string, any>;
}