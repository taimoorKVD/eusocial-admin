import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  MasterPlan,
  PlanModuleCatalogItem,
  PlanWritePayload,
} from '../interfaces/master-billing';

@Injectable({ providedIn: 'root' })
export class MasterPlanService {
  private readonly baseUrl = `${environment.apiUrl}/plans`;

  constructor(private http: HttpClient) {}

  getModules(): Observable<{ success: boolean; count: number; data: PlanModuleCatalogItem[] }> {
    return this.http.get<{ success: boolean; count: number; data: PlanModuleCatalogItem[] }>(
      `${this.baseUrl}/modules`
    );
  }

  getPlans(): Observable<{ success: boolean; count: number; data: MasterPlan[] }> {
    return this.http.get<{ success: boolean; count: number; data: MasterPlan[] }>(this.baseUrl);
  }

  getPlan(id: number): Observable<{ success: boolean; data: MasterPlan }> {
    return this.http.get<{ success: boolean; data: MasterPlan }>(`${this.baseUrl}/${id}`);
  }

  createPlan(payload: PlanWritePayload): Observable<{ success: boolean; message?: string; data: MasterPlan }> {
    return this.http.post<{ success: boolean; message?: string; data: MasterPlan }>(this.baseUrl, payload);
  }

  updatePlan(
    id: number,
    payload: Partial<PlanWritePayload>
  ): Observable<{ success: boolean; message?: string; data: MasterPlan }> {
    return this.http.put<{ success: boolean; message?: string; data: MasterPlan }>(
      `${this.baseUrl}/${id}`,
      payload
    );
  }

  deletePlan(id: number): Observable<{ success: boolean; message?: string }> {
    return this.http.delete<{ success: boolean; message?: string }>(`${this.baseUrl}/${id}`);
  }
}
