import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { TenantLocationService } from './tenant-location.service';
import { TenantSessionService } from './tenant-session.service';

/**
 * Location endpoints. Only countries are persisted after login.
 * States and cities are loaded on demand and kept in memory.
 */
export type LocationKind = 'countries' | 'states' | 'cities';

interface LocationApiResponse {
  data: any[];
  [key: string]: unknown;
}

/**
 * Caches Countries after tenant login in Local Storage (with an in-memory
 * Signal mirror). States and cities are fetched lazily by parent id and
 * never written to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class LocationCacheService {
  private readonly locationService = inject(TenantLocationService);
  private readonly session = inject(TenantSessionService);

  private readonly STORAGE_PREFIX = 'tenant_location_cache';

  private readonly responses: Record<LocationKind, ReturnType<typeof signal<LocationApiResponse | null>>> = {
    countries: signal<LocationApiResponse | null>(null),
    states: signal<LocationApiResponse | null>(null),
    cities: signal<LocationApiResponse | null>(null),
  };

  /** In-flight guards so warm-up never triggers duplicate country requests. */
  private readonly inFlight: Record<LocationKind, boolean> = {
    countries: false,
    states: false,
    cities: false,
  };

  private readonly statesByCountry = new Map<string, any[]>();
  private readonly citiesByState = new Map<string, any[]>();
  private readonly citiesByCountry = new Map<string, any[]>();
  private readonly statesInFlight = new Map<string, Observable<any[]>>();
  private readonly citiesByStateInFlight = new Map<string, Observable<any[]>>();
  private readonly citiesByCountryInFlight = new Map<string, Observable<any[]>>();

  readonly countries: Signal<any[]> = computed(() => this.responses.countries()?.data ?? []);
  readonly states: Signal<any[]> = computed(() => this.responses.states()?.data ?? []);
  readonly cities: Signal<any[]> = computed(() => this.responses.cities()?.data ?? []);

  constructor() {
    this.evictPersistedKind('states');
    this.evictPersistedKind('cities');
    this.hydrateFromStorage();
  }

  /**
   * Maps an `optionSource.endpoint` value to a location kind, or null when the
   * endpoint is any other dynamic module (vendors, items, ...).
   */
  resolveKind(endpoint?: string | null): LocationKind | null {
    if (!endpoint) {
      return null;
    }

    const normalized = endpoint
      .trim()
      .toLowerCase()
      .replace(/^\/+/, '')
      .split('?')[0]
      .replace(/\/+$/, '');

    if (normalized === 'countries' || normalized === 'states' || normalized === 'cities') {
      return normalized;
    }
    return null;
  }

  /**
   * Returns a cached response shaped like the API payload (`{ data: [...] }`)
   * for a location endpoint, or null when the endpoint is not a location one
   * or the country cache is not yet available (caller then falls back to the API).
   *
   * States and cities are never served as a full catalog, so callers do not
   * trigger GET /states or GET /cities.
   */
  getCachedResponse<T>(endpoint?: string | null): Observable<T> | null {
    const kind = this.resolveKind(endpoint);
    if (!kind) {
      return null;
    }

    if (kind === 'states' || kind === 'cities') {
      return of({ data: [] } as unknown as T);
    }

    const response = this.responses.countries();
    if (response && Array.isArray(response.data) && response.data.length) {
      return of(response as unknown as T);
    }

    return null;
  }

  /**
   * Fetches Countries once and stores them in the tenant localStorage cache.
   * States and cities are not loaded here.
   */
  warmCache(force = false): void {
    this.fetchCountries(force);
  }

  /** States belonging to a country, from in-memory lazy loads only. */
  getStatesByCountry(countryId: unknown): any[] {
    const key = this.parentKey(countryId);
    if (!key) {
      return [];
    }
    return this.statesByCountry.get(key) ?? [];
  }

  /** Cities belonging to a state, from in-memory lazy loads only. */
  getCitiesByState(stateId: unknown): any[] {
    const key = this.parentKey(stateId);
    if (!key) {
      return [];
    }
    return this.citiesByState.get(key) ?? [];
  }

  /** Cities belonging to a country, from in-memory lazy loads only. */
  getCitiesByCountry(countryId: unknown): any[] {
    const key = this.parentKey(countryId);
    if (!key) {
      return [];
    }
    return this.citiesByCountry.get(key) ?? [];
  }

  /** Dependent states for a country: in-memory first, then GET /states?country_id=. */
  getStatesForCountry(countryId: unknown): Observable<any[]> {
    const key = this.parentKey(countryId);
    if (!key) {
      return of([]);
    }

    const cached = this.statesByCountry.get(key);
    if (cached) {
      return of(cached);
    }

    const pending = this.statesInFlight.get(key);
    if (pending) {
      return pending;
    }

    const request = this.locationService.getStates(Number(key)).pipe(
      map((res) => (res?.data ?? []).map((record) => this.slimRecord('states', record))),
      tap((records) => {
        this.statesByCountry.set(key, records);
        this.mergeMemory('states', records);
        this.statesInFlight.delete(key);
      }),
      catchError(() => {
        this.statesInFlight.delete(key);
        return of([]);
      }),
      shareReplay(1),
    );

    this.statesInFlight.set(key, request);
    return request;
  }

  /** Dependent cities for a state: in-memory first, then GET /cities?state_id=. */
  getCitiesForState(stateId: unknown): Observable<any[]> {
    const key = this.parentKey(stateId);
    if (!key) {
      return of([]);
    }

    const cached = this.citiesByState.get(key);
    if (cached) {
      return of(cached);
    }

    const pending = this.citiesByStateInFlight.get(key);
    if (pending) {
      return pending;
    }

    const request = this.locationService.getCities(Number(key)).pipe(
      map((res) => (res?.data ?? []).map((record) => this.slimRecord('cities', record))),
      tap((records) => {
        this.citiesByState.set(key, records);
        this.mergeMemory('cities', records);
        this.citiesByStateInFlight.delete(key);
      }),
      catchError(() => {
        this.citiesByStateInFlight.delete(key);
        return of([]);
      }),
      shareReplay(1),
    );

    this.citiesByStateInFlight.set(key, request);
    return request;
  }

  /** Dependent cities for a country (no State field): GET /cities?country_id=. */
  getCitiesForCountry(countryId: unknown): Observable<any[]> {
    const key = this.parentKey(countryId);
    if (!key) {
      return of([]);
    }

    const cached = this.citiesByCountry.get(key);
    if (cached) {
      return of(cached);
    }

    const pending = this.citiesByCountryInFlight.get(key);
    if (pending) {
      return pending;
    }

    const request = this.locationService.getCitiesByCountry(Number(key)).pipe(
      map((res) => (res?.data ?? []).map((record) => this.slimRecord('cities', record))),
      tap((records) => {
        this.citiesByCountry.set(key, records);
        this.mergeMemory('cities', records);
        this.citiesByCountryInFlight.delete(key);
      }),
      catchError(() => {
        this.citiesByCountryInFlight.delete(key);
        return of([]);
      }),
      shareReplay(1),
    );

    this.citiesByCountryInFlight.set(key, request);
    return request;
  }

  /** Removes every persisted location cache entry (e.g. on logout). */
  clear(): void {
    this.statesByCountry.clear();
    this.citiesByState.clear();
    this.citiesByCountry.clear();
    this.statesInFlight.clear();
    this.citiesByStateInFlight.clear();
    this.citiesByCountryInFlight.clear();

    (['countries', 'states', 'cities'] as LocationKind[]).forEach((kind) => {
      this.responses[kind].set(null);
      try {
        localStorage.removeItem(this.storageKey(kind));
      } catch {
        // ignore storage access issues
      }
    });
  }

  private fetchCountries(force: boolean): void {
    if (this.inFlight.countries) {
      return;
    }

    if (!force && (this.responses.countries()?.data?.length ?? 0) > 0) {
      return;
    }

    this.inFlight.countries = true;

    this.locationService
      .getCountries()
      .pipe(
        catchError(() => of(null)),
        tap(() => (this.inFlight.countries = false)),
      )
      .subscribe((response) => {
        if (!response || !Array.isArray(response.data)) {
          return;
        }
        const slimmed = this.slimResponse('countries', response);
        this.responses.countries.set(slimmed);
        this.persistCountries(slimmed);
      });
  }

  private mergeMemory(kind: 'states' | 'cities', records: any[]): void {
    const existing = this.responses[kind]()?.data ?? [];
    const byId = new Map<string, any>();

    for (const record of existing) {
      const id = record?.id;
      if (id !== undefined && id !== null) {
        byId.set(String(id), record);
      }
    }

    for (const record of records) {
      const id = record?.id;
      if (id !== undefined && id !== null) {
        byId.set(String(id), record);
      }
    }

    this.responses[kind].set({ data: [...byId.values()] });
  }

  private parentKey(parentId: unknown): string | null {
    const raw = Array.isArray(parentId) ? parentId[0] : parentId;

    if (raw === null || raw === undefined || raw === '') {
      return null;
    }

    if (typeof raw === 'object') {
      const id = (raw as { id?: unknown }).id;
      if (id === null || id === undefined || id === '') {
        return null;
      }
      return String(id);
    }

    return String(raw);
  }

  private hydrateFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey('countries'));
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as LocationApiResponse;
      if (parsed && Array.isArray(parsed.data)) {
        this.responses.countries.set(parsed);
      }
    } catch {
      // Corrupt/unavailable storage — cache stays empty and API is used.
    }
  }

  private persistCountries(response: LocationApiResponse): void {
    try {
      localStorage.setItem(this.storageKey('countries'), JSON.stringify(response));
    } catch {
      this.evictPersistedKind('states');
      this.evictPersistedKind('cities');
    }
  }

  private evictPersistedKind(kind: 'states' | 'cities'): void {
    try {
      const prefix = `${this.STORAGE_PREFIX}_${kind}_`;
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          keys.push(key);
        }
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } catch {
      // ignore storage access issues
    }
  }

  private slimResponse(kind: LocationKind, response: LocationApiResponse): LocationApiResponse {
    return {
      ...response,
      data: (response.data ?? []).map((record) => this.slimRecord(kind, record)),
    };
  }

  private slimRecord(kind: LocationKind, record: any): any {
    if (!record || typeof record !== 'object') {
      return record;
    }

    const id = record.id ?? record.city_id ?? record.state_id ?? record.country_id;
    const name = record.name ?? record.label ?? record.title ?? record.city ?? record.state ?? record.country;

    if (kind === 'countries') {
      return { id, name, label: name };
    }

    if (kind === 'states') {
      return {
        id,
        name,
        label: name,
        country_id: record.country_id ?? record.countryId ?? record.country,
      };
    }

    return {
      id,
      name,
      label: name,
      state_id: record.state_id ?? record.stateId ?? record.state,
      country_id: record.country_id ?? record.countryId ?? record.country,
    };
  }

  private storageKey(kind: LocationKind): string {
    const slug = this.session.getSlug() || 'default';
    return `${this.STORAGE_PREFIX}_${kind}_${slug}`;
  }
}
