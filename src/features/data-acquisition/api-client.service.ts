import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ApiClientService {
  private readonly logger = new Logger(ApiClientService.name);

  async discoverApiEndpoints(domain: string): Promise<string[]> {
    const commonApiPaths = [
      '/api/properties',
      '/api/listings',
      '/api/search',
      '/api/v1/properties',
      '/api/v2/properties',
      '/feed/properties',
      '/rss/properties',
      '/sitemap.xml',
    ];

    const endpoints: string[] = [];

    for (const path of commonApiPaths) {
      const url = `https://${domain}${path}`;

      try {
        const response = await axios.head(url, {
          timeout: 5000,
          validateStatus: (status) =>
            status === 200 || status === 301 || status === 302,
        });

        if (response.status === 200) {
          const contentType = response.headers['content-type'];

          if (
            contentType?.includes('application/json') ||
            contentType?.includes('application/xml') ||
            contentType?.includes('text/xml')
          ) {
            endpoints.push(url);
          }
        }
      } catch (error) {
        // エンドポイントが存在しない場合は無視
      }
    }

    return endpoints;
  }

  async fetchData(endpoint: string): Promise<any> {
    try {
      const response = await axios.get(endpoint, {
        headers: {
          Accept: 'application/json, application/xml, text/xml',
          'User-Agent': 'Mozilla/5.0 (compatible; PropertyBot/1.0)',
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      throw new Error(`API取得失敗: ${error.message}`);
    }
  }
}
