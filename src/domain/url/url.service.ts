import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { Url } from './url.interface';

@Injectable()
export class UrlService implements OnModuleInit {
  private readonly logger = new Logger(UrlService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.seedInitialData();
  }

  private async seedInitialData() {
    const testUrlString =
      'https://www.athome.co.jp/buy_other/hiroshima/list/?pref=34&cities=hiroshima_naka,hiroshima_higashi,hiroshima_minami,hiroshima_nishi,hiroshima_asaminami,hiroshima_asakita,hiroshima_aki,hiroshima_saeki,kure,takehara,mihara,onomichi,fukuyama,fuchu,miyoshi,shobara,otake,higashihiroshima,hatsukaichi,akitakata,etajima,aki_fuchu,aki_kaita,aki_kumano,aki_saka,yamagata_akiota,yamagata_kitahiroshima,toyota_osakikamijima,sera_sera,jinseki_jinsekikogen&basic=kp401,kp522,kt201,kf201,ke001,kn001,kj001&tsubo=0&tanka=0&kod=&q=1';

    const existingUrl = this.databaseService.findOne(
      'SELECT * FROM urls WHERE url = ?',
      [testUrlString],
    ) as Url | undefined;

    if (!existingUrl) {
      this.logger.log('テスト用のURLデータをデータベースに登録します...');
      this.databaseService.execute(
        'INSERT INTO urls (name, url, selector, is_active) VALUES (?, ?, ?, ?)',
        ['広島県のテスト物件', testUrlString, '#item-list', 1],
      );
      this.logger.log('テストデータの登録が完了しました。');
    }
  }

  findAllActive(): Promise<Url[]> {
    const results = this.databaseService.query<Url>(
      'SELECT * FROM urls WHERE is_active = ?',
      [1],
    );
    return Promise.resolve(results);
  }

  updateHash(id: number, hash: string): Promise<void> {
    this.databaseService.execute(
      'UPDATE urls SET content_hash = ? WHERE id = ?',
      [hash, id],
    );
    return Promise.resolve();
  }
}
