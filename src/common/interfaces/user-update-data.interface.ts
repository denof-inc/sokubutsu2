export interface UserUpdateData {
  lastActiveAt: Date;
  username?: string;
  firstName: string;
  lastName?: string;
  languageCode?: string;
  isActive?: boolean;
}