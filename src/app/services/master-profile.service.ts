import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  MasterProfile,
  MasterProfileResponse,
} from '../interfaces/master-dashboard';

export interface MasterProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  name?: string;
  password?: string;
  password_confirm?: string;
}

@Injectable({ providedIn: 'root' })
export class MasterProfileService {
  private readonly profileUrl = `${environment.apiUrl}/users/profile`;
  private readonly authUserUrl = `${environment.apiUrl}/auth/user`;

  constructor(private http: HttpClient) {}

  getProfile(): Observable<MasterProfileResponse> {
    return this.http.get<MasterProfileResponse>(this.profileUrl).pipe(
      catchError((err) => {
        // Backend /users/profile can 500 while phone/profile migration is incomplete.
        // Fall back to the stable auth user endpoint so the profile screen still loads.
        if (err?.status >= 500 || err?.status === 404) {
          return this.http.get<any>(this.authUserUrl).pipe(
            map((res) => this.toProfileResponse(res, 'Profile fetched successfully'))
          );
        }
        return throwError(() => err);
      })
    );
  }

  updateProfile(payload: MasterProfileUpdatePayload): Observable<MasterProfileResponse> {
    const body: MasterProfileUpdatePayload = { ...payload };

    // Keep name in sync for backends that still expect `name` instead of split fields.
    if (!body.name && (body.first_name || body.last_name)) {
      body.name = `${body.first_name || ''} ${body.last_name || ''}`.trim();
    }

    return this.http.put<MasterProfileResponse>(this.profileUrl, body).pipe(
      map((res) => {
        // Some deployments return the user object directly instead of { success, data }.
        if (res && !(res as MasterProfileResponse).data && (res as any).id) {
          return this.toProfileResponse(res, (res as any).message || 'Profile updated successfully');
        }
        return res;
      })
    );
  }

  private toProfileResponse(raw: any, message: string): MasterProfileResponse {
    const source = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
    const profile = this.normalizeProfile(source);

    return {
      success: raw?.success ?? true,
      message: raw?.message || message,
      user_type: raw?.user_type || 'master',
      data: profile,
    };
  }

  private normalizeProfile(source: any): MasterProfile {
    const name: string = source?.name || '';
    const parts = name.trim().split(/\s+/).filter(Boolean);

    return {
      id: source?.id,
      name: name || `${source?.first_name || ''} ${source?.last_name || ''}`.trim(),
      first_name: source?.first_name || parts[0] || '',
      last_name: source?.last_name || parts.slice(1).join(' ') || '',
      email: source?.email || '',
      role: source?.role ?? null,
      user_type: source?.user_type,
      account_type: source?.account_type,
      created_at: source?.created_at || source?.createdAt,
      updated_at: source?.updated_at || source?.updatedAt,
    };
  }
}
