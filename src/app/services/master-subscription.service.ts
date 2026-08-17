import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ListMeta,
  MasterSubscription,
  SubscriptionStats,
  SubscriptionStatus,
} from '../interfaces/master-billing';

export interface SubscriptionListQuery {
  page?: number;
  limit?: number;
  tenant?: string;
  planId?: number | string;
  status?: SubscriptionStatus | '';
}

@Injectable({ providedIn: 'root' })
export class MasterSubscriptionService {
  private readonly baseUrl = `${environment.apiUrl}/subscriptions`;

  constructor(private http: HttpClient) {}

  getStats(): Observable<{ success: boolean; data: SubscriptionStats }> {
    return this.http.get<{ success: boolean; data: SubscriptionStats }>(`${this.baseUrl}/stats`);
  }

  getSubscriptions(
    query: SubscriptionListQuery = {}
  ): Observable<{ success: boolean; meta: ListMeta; data: MasterSubscription[] }> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<{ success: boolean; meta: ListMeta; data: MasterSubscription[] }>(
      this.baseUrl,
      { params }
    );
  }

  getSubscription(id: number): Observable<{ success: boolean; data: MasterSubscription }> {
    return this.http.get<{ success: boolean; data: MasterSubscription }>(`${this.baseUrl}/${id}`);
  }

  createSubscription(payload: {
    tenantId: number;
    planId: number;
    billingCycle: 'monthly' | 'yearly';
    chargeNow?: boolean;
    paymentMethodId?: string;
    trialDays?: number;
  }): Observable<{ success: boolean; message?: string; data: MasterSubscription }> {
    return this.http.post<{ success: boolean; message?: string; data: MasterSubscription }>(
      this.baseUrl,
      payload
    );
  }

  changePlan(
    id: number,
    payload: { planId: number; prorate?: boolean }
  ): Observable<{ success: boolean; message?: string; data: MasterSubscription }> {
    return this.http.put<{ success: boolean; message?: string; data: MasterSubscription }>(
      `${this.baseUrl}/${id}/change-plan`,
      payload
    );
  }

  cancelSubscription(
    id: number,
    payload: { atPeriodEnd?: boolean } = { atPeriodEnd: true }
  ): Observable<{ success: boolean; message?: string; data?: MasterSubscription }> {
    return this.http.post<{ success: boolean; message?: string; data?: MasterSubscription }>(
      `${this.baseUrl}/${id}/cancel`,
      payload
    );
  }
}
