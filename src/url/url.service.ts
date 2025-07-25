import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Url } from './url.entity';

@Injectable()
export class UrlService implements OnModuleInit {
  private readonly logger = new Logger(UrlService.name);

  constructor(
    @InjectRepository(Url)
    private readonly urlRepository: Repository<Url>,
  ) {}

  async onModuleInit() {
    await this.seedInitialData();
  }

  private async seedInitialData() {
    const existingUrl = await this.urlRepository.findOne({
      where: { url: 'https://www.athome.co.jp/buy_other/hiroshima/list/?pref=34&cities=hiroshima_naka,hiroshima_higashi,hiroshima_minami,hiroshima_nishi,hiroshima_asaminami,hiroshima_asakita,hiroshima_aki,hiroshima_saeki,kure,takehara,mihara,onomichi,fukuyama,fuchu,miyoshi,shobara,otake,higashihiroshima,hatsukaichi,akitakata,etajima,aki_fuchu,aki_kaita,aki_kumano,aki_saka,yamagata_akiota,yamagata_kitahiroshima,toyota_osakikamijima,sera_sera,jinseki_jinsekikogen&basic=kp401,kp522,kt201,kf201,ke001,kn001,kj001&tsubo=0&tanka=0&kod=&q=1' },
    });

    if (!existingUrl) {
      this.logger.log('テスト用のURLデータをデータベースに登録します...');
      const testUrl = this.urlRepository.create({
        name: '広島県のテスト物件',
        url: 'https://www.athome.co.jp/buy_other/hiroshima/list/?pref=34&cities=hiroshima_naka,hiroshima_higashi,hiroshima_minami,hiroshima_nishi,hiroshima_asaminami,hiroshima_asakita,hiroshima_aki,hiroshima_saeki,kure,takehara,mihara,onomichi,fukuyama,fuchu,miyoshi,shobara,otake,higashihiroshima,hatsukaichi,akitakata,etajima,aki_fuchu,aki_kaita,aki_kumano,aki_saka,yamagata_akiota,yamagata_kitahiroshima,toyota_osakikamijima,sera_sera,jinseki_jinsekikogen&basic=kp401,kp522,kt201,kf201,ke001,kn001,kj001&tsubo=0&tanka=0&kod=&q=1',
        selector: '#item-list',
        isActive: true,
      });
      await this.urlRepository.save(testUrl);
      this.logger.log('テストデータの登録が完了しました。');
    }
  }

  findAllActive(): Promise<Url[]> {
    return this.urlRepository.find({ where: { isActive: true } });
  }
}
