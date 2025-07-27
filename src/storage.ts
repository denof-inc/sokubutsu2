import * as fs from 'fs';
import * as path from 'path';

interface StorageData {
  hashes: Record<string, string>;
  lastChecked: Record<string, string>;
  statistics: {
    totalChecks: number;
    newListingsFound: number;
    errors: number;
    startedAt: string;
  };
}

export class SimpleStorage {
  private dataPath: string;
  private data: StorageData;

  constructor(dataDir: string = './data') {
    this.dataPath = path.join(dataDir, 'monitoring.json');
    this.ensureDataDir(dataDir);
    this.loadData();
  }

  private ensureDataDir(dataDir: string): void {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private loadData(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const content = fs.readFileSync(this.dataPath, 'utf-8');
        this.data = JSON.parse(content);
      } else {
        this.data = {
          hashes: {},
          lastChecked: {},
          statistics: {
            totalChecks: 0,
            newListingsFound: 0,
            errors: 0,
            startedAt: new Date().toISOString()
          }
        };
        this.saveData();
      }
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      this.data = {
        hashes: {},
        lastChecked: {},
        statistics: {
          totalChecks: 0,
          newListingsFound: 0,
          errors: 0,
          startedAt: new Date().toISOString()
        }
      };
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(
        this.dataPath,
        JSON.stringify(this.data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('データ保存エラー:', error);
    }
  }

  getHash(url: string): string | null {
    return this.data.hashes[url] || null;
  }

  setHash(url: string, hash: string): void {
    this.data.hashes[url] = hash;
    this.data.lastChecked[url] = new Date().toISOString();
    this.saveData();
  }

  getLastChecked(url: string): Date | null {
    const lastChecked = this.data.lastChecked[url];
    return lastChecked ? new Date(lastChecked) : null;
  }

  incrementTotalChecks(): void {
    this.data.statistics.totalChecks++;
    this.saveData();
  }

  incrementNewListings(): void {
    this.data.statistics.newListingsFound++;
    this.saveData();
  }

  incrementErrors(): void {
    this.data.statistics.errors++;
    this.saveData();
  }

  getStatistics(): typeof this.data.statistics {
    return { ...this.data.statistics };
  }

  clearUrl(url: string): void {
    delete this.data.hashes[url];
    delete this.data.lastChecked[url];
    this.saveData();
  }

  getAllUrls(): string[] {
    return Object.keys(this.data.hashes);
  }
}