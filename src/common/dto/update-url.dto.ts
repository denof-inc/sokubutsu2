import { PartialType } from '@nestjs/mapped-types';
import { CreateUrlDto } from './create-url.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUrlDto extends PartialType(CreateUrlDto) {
  @IsOptional()
  @IsBoolean({ message: 'isActiveはboolean型で入力してください' })
  isActive?: boolean;
}
