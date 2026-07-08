import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { TenantLocationService } from './tenant-location.service';
import { TenantSessionService } from './tenant-session.service';

/**
 * The three location endpoints that are cached once after tenant login and
 * reused across every dynamic module instead of being re-fetched.
 */
export type LocationKind = 'countries' | 'states' | 'cities';

interface LocationApiResponse {
  data: any[];
  [key: string]: unknown;
}

/**
 * Candidate keys used when filtering cached child records by their parent id.
 * The API is not modified, so we defensively check the common naming variants.
 */
const COUNTRY_KEYS = ['country_id', 'countryId', 'country'];
const STATE_KEYS = ['state_id', 'stateId', 'state'];

/**
 * Caches Countries / States / Cities after tenant login and serves them from
 * Local Storage (with an in-memory Signal mirror) so dynamic dropdowns for
 * these endpoints never hit the API again. Any other endpoint is untouched.
 *
 * Dependent lookups (states-by-country, cities-by-state, cities-by-country)
 * are resolved from the cache first and only fall back to the API when the
 * cache cannot answer the query.
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

  /** In-flight guards so warm-up never triggers duplicate requests. */
  private readonly inFlight: Record<LocationKind, boolean> = {
    countries: false,
    states: false,
    cities: false,
  };

  readonly countries: Signal<any[]> = computed(() => this.responses.countries()?.data ?? []);
  readonly states: Signal<any[]> = computed(() => this.responses.states()?.data ?? []);
  readonly cities: Signal<any[]> = computed(() => this.responses.cities()?.data ?? []);

  constructor() {
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
   * or the cache is not yet available (caller then falls back to the API).
   */
  getCachedResponse<T>(endpoint?: string | null): Observable<T> | null {
    const kind = this.resolveKind(endpoint);
    if (!kind) {
      return null;
    }

    const response = this.responses[kind]();
    if (response && Array.isArray(response.data) && response.data.length) {
      return of(response as unknown as T);
    }

    return null;
  }

  /**
   * Fetches Countries, States and Cities once and stores them. Missing kinds
   * are fetched; already-cached kinds are skipped unless `force` is true.
   */
  warmCache(force = false): void {
    (['countries', 'states', 'cities'] as LocationKind[]).forEach((kind) =>
      this.fetchKind(kind, force),
    );
  }

  /** States belonging to a country, filtered from cache. */
  getStatesByCountry(countryId: unknown): any[] {
    return this.filterByParent(this.states(), COUNTRY_KEYS, countryId);
  }

  /** Cities belonging to a state, filtered from cache. */
  getCitiesByState(stateId: unknown): any[] {
    return this.filterByParent(this.cities(), STATE_KEYS, stateId);
  }

  /** Cities belonging to a country, filtered from cache. */
  getCitiesByCountry(countryId: unknown): any[] {
    return this.filterByParent(this.cities(), COUNTRY_KEYS, countryId);
  }

  /** Dependent states for a country: cache first, API fallback. */
  getStatesForCountry(countryId: unknown): Observable<any[]> {
    const cached = this.getStatesByCountry(countryId);
    if (cached.length) {
      return of(cached);
    }

    return this.locationService.getStates(Number(countryId)).pipe(
      map((res) => res?.data ?? []),
      catchError(() => of([])),
    );
  }

  /** Dependent cities for a state: cache first, API fallback. */
  getCitiesForState(stateId: unknown): Observable<any[]> {
    const cached = this.getCitiesByState(stateId);
    if (cached.length) {
      return of(cached);
    }

    return this.locationService.getCities(Number(stateId)).pipe(
      map((res) => res?.data ?? []),
      catchError(() => of([])),
    );
  }

  /** Dependent cities for a country (no State field): cache first, API fallback. */
  getCitiesForCountry(countryId: unknown): Observable<any[]> {
    const cached = this.getCitiesByCountry(countryId);
    if (cached.length) {
      return of(cached);
    }

    return this.locationService.getCitiesByCountry(Number(countryId)).pipe(
      map((res) => res?.data ?? []),
      catchError(() => of([])),
    );
  }

  /** Removes every persisted location cache entry (e.g. on logout). */
  clear(): void {
    (['countries', 'states', 'cities'] as LocationKind[]).forEach((kind) => {
      this.responses[kind].set(null);
      try {
        localStorage.removeItem(this.storageKey(kind));
      } catch {
        // ignore storage access issues
      }
    });
  }

  private fetchKind(kind: LocationKind, force: boolean): void {
    if (this.inFlight[kind]) {
      return;
    }

    if (!force && (this.responses[kind]()?.data?.length ?? 0) > 0) {
      return;
    }

    this.inFlight[kind] = true;

    this.requestKind(kind)
      .pipe(
        catchError(() => of(null)),
        tap(() => (this.inFlight[kind] = false)),
      )
      .subscribe((response) => {
        if (!response || !Array.isArray(response.data)) {
          return;
        }

        this.responses[kind].set(response);
        this.persist(kind, response);
      });
  }

  private requestKind(kind: LocationKind): Observable<LocationApiResponse> {
    switch (kind) {
      case 'countries':
        return this.locationService.getCountries();
      case 'states':
        return this.locationService.getAllStates();
      case 'cities':
        return this.locationService.getAllCities();
    }
  }

  private filterByParent(records: any[], keys: string[], parentId: unknown): any[] {
    if (parentId === null || parentId === undefined || parentId === '') {
      return [];
    }

    const target = String(parentId);

    return records.filter((record) =>
      keys.some((key) => {
        const value = record?.[key];
        return value !== undefined && value !== null && String(value) === target;
      }),
    );
  }

  private hydrateFromStorage(): void {
    (['countries', 'states', 'cities'] as LocationKind[]).forEach((kind) => {
      try {
        const raw = localStorage.getItem(this.storageKey(kind));
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw) as LocationApiResponse;
        if (parsed && Array.isArray(parsed.data)) {
          this.responses[kind].set(parsed);
        }
      } catch {
        // Corrupt/unavailable storage — cache stays empty and API is used.
      }
    });
  }

  private persist(kind: LocationKind, response: LocationApiResponse): void {
    try {
      localStorage.setItem(this.storageKey(kind), JSON.stringify(response));
    } catch {
      // Storage quota exceeded (large city lists) — in-memory Signal still
      // serves the data for the rest of the session.
    }
  }

  private storageKey(kind: LocationKind): string {
    const slug = this.session.getSlug() || 'default';
    return `${this.STORAGE_PREFIX}_${kind}_${slug}`;
  }
}
