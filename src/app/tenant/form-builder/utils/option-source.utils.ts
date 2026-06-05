import { FormField, OptionSource } from '../models/form-field.model';

const ENDPOINT_ALIASES: Record<string, string> = {
  '/api/job-positions': '/jobpositions',
  '/api/job-position': '/jobpositions',
  '/job-positions': '/jobpositions',
  '/job-position': '/jobpositions',
  'job-positions': '/jobpositions',
  'job-position': '/jobpositions',
  '/api/jobpositions': '/jobpositions',
  jobpositions: '/jobpositions',
  '/api/locations': '/locations',
  locations: '/locations',
};

const KNOWN_FIELD_OPTION_SOURCES: Record<string, OptionSource> = {
  job_position_id: {
    type: 'api',
    endpoint: '/jobpositions',
    response: { labelKey: 'name', valueKey: 'id', dataPath: 'data' },
  },
  jobposition_id: {
    type: 'api',
    endpoint: '/jobpositions',
    response: { labelKey: 'name', valueKey: 'id', dataPath: 'data' },
  },
  location_id: {
    type: 'api',
    endpoint: '/locations',
    response: { labelKey: 'name', valueKey: 'id', dataPath: 'data' },
  },
};

export function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  const lower = trimmed.toLowerCase();

  if (ENDPOINT_ALIASES[lower]) {
    return ENDPOINT_ALIASES[lower];
  }

  if (ENDPOINT_ALIASES[trimmed]) {
    return ENDPOINT_ALIASES[trimmed];
  }

  return trimmed;
}

export function normalizeOptionSource(
  raw: unknown
): OptionSource | undefined {
  if (!raw) {
    return undefined;
  }

  let source = raw;

  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return undefined;
    }
  }

  if (typeof source !== 'object') {
    return undefined;
  }

  const record = source as Record<string, unknown>;
  const responseRaw = record['response'] ?? record['responseMapping'];

  if (!record['type'] && !record['endpoint'] && !record['url']) {
    return undefined;
  }

  const response =
    responseRaw && typeof responseRaw === 'object'
      ? (responseRaw as Record<string, unknown>)
      : undefined;

  const endpoint = String(
    record['endpoint'] ?? record['url'] ?? record['path'] ?? ''
  ).trim();

  if (!endpoint) {
    return undefined;
  }

  return {
    type: String(record['type'] ?? 'api').toLowerCase(),
    endpoint: normalizeEndpoint(endpoint),
    response: {
      labelKey: String(
        response?.['labelKey'] ?? response?.['label_key'] ?? 'name'
      ),
      valueKey: String(
        response?.['valueKey'] ?? response?.['value_key'] ?? 'id'
      ),
      dataPath:
        (response?.['dataPath'] as string | undefined) ??
        (response?.['data_path'] as string | undefined) ??
        'data',
    },
    options: Array.isArray(record['options'])
      ? (record['options'] as OptionSource['options'])
      : undefined,
  };
}

export function readOptionSourceFromField(
  field: Partial<FormField> & Record<string, unknown>
): OptionSource | undefined {
  const direct = normalizeOptionSource(
    field.optionSource ?? field['option_source']
  );

  if (direct) {
    return direct;
  }

  const fieldName = String(
    field.name ??
      field['fieldKey'] ??
      field['systemMappingKey'] ??
      field['system_mapping_key'] ??
      ''
  )
    .trim()
    .toLowerCase();

  if (fieldName && KNOWN_FIELD_OPTION_SOURCES[fieldName]) {
    return { ...KNOWN_FIELD_OPTION_SOURCES[fieldName] };
  }

  if (fieldName.includes('job_position') || fieldName.includes('jobposition')) {
    return { ...KNOWN_FIELD_OPTION_SOURCES['job_position_id'] };
  }

  if (fieldName.includes('location')) {
    return { ...KNOWN_FIELD_OPTION_SOURCES['location_id'] };
  }

  return undefined;
}

export function resolveFieldOptionSource(field: FormField): OptionSource | undefined {
  return (
    normalizeOptionSource(field.optionSource) ??
    readOptionSourceFromField(field as FormField & Record<string, unknown>)
  );
}
