export interface Url {
  id: string;
  userId: string;
  name: string;
  url: string;
  selector: string;
  contentHash: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
