export interface Url {
  id: number;
  name: string;
  url: string;
  selector: string;
  contentHash: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
