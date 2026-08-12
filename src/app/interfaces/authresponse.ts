import { User } from "./user";

export interface AuthResponse {
    success: boolean;
    message: string;
    user_type?: string;
    access_token: string;
    refresh_token?: string;
    expires_in?: string;
    refresh_expires_in_days?: number;
    user: User;
}