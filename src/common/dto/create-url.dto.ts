import {
  IsUrl,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUrlDto {
  @IsUrl({}, { message: '有効なURLを入力してください' })
  @IsNotEmpty({ message: 'URLは必須です' })
  @MaxLength(2048, { message: 'URLは2048文字以内で入力してください' })
  url: string;

  @IsString({ message: '名前は文字列で入力してください' })
  @IsNotEmpty({ message: '名前は必須です' })
  @MaxLength(100, { message: '名前は100文字以内で入力してください' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '説明は500文字以内で入力してください' })
  description?: string;
}
