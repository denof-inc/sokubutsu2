import { Module } from '@nestjs/common';
import { UrlService } from './url.service';
import { TypeOrmModule } from '@nestjs/typeorm'; // ★ インポート
import { Url } from './url.entity'; // ★ インポート

@Module({
  imports: [TypeOrmModule.forFeature([Url])], // ★ Urlエンティティをこのモジュールで使えるように登録
  providers: [UrlService],
  exports: [UrlService], // ★ 他のモジュールからUrlServiceを使えるようにエクスポート
})
export class UrlModule {}
