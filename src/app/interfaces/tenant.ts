export interface Tenant {
  id: number;
  name: string;
  dbName: string;
  subdomain: string;
  customDomain: string | null;
  createdAt: string;
}
