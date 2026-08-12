import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MasterDashboardResponse } from '../interfaces/master-dashboard';

@Injectable({ providedIn: 'root' })
export class MasterDashboardService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<MasterDashboardResponse> {
    return this.http.get<MasterDashboardResponse>(`${this.baseUrl}/dashboard`);
  }
}
