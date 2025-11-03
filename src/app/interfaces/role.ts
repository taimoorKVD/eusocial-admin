import { Permission } from "./permission";

export interface Role {
    id: number;
    name: string;
    createdAt?: string;
    updatedAt?: string;
    permissions?: Permission[];
}
