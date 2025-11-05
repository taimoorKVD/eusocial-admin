import { User } from "./user";

export interface AuthResponse {
    success: boolean;
    message: string;
    access_token: string;
    user: User;
}