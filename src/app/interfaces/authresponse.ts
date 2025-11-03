export interface AuthResponse {
    success: boolean;
    message: string;
    access_token: string;
    user: {
        id: number;
        name: string;
        email: string;
        role: string;
    };
}