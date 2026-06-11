import { FormField, OptionSource } from '../models/form-field.model';

export function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim();
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

  const type = String(record['type'] ?? 'api').toLowerCase();
  const endpoint = String(
    record['endpoint'] ?? record['url'] ?? record['path'] ?? ''
  ).trim();

  if (!endpoint && type !== 'static') {
    return undefined;
  }

  const options = Array.isArray(record['options'])
    ? (record['options'] as OptionSource['options'])
    : undefined;

  if (type === 'static') {
    return {
      type: 'static',
      endpoint: endpoint ? normalizeEndpoint(endpoint) : undefined,
      options,
    };
  }

  if (type === 'dynamic') {
    return {
      type: 'dynamic',
      endpoint,
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
      options,
    };
  }

  return {
    type,
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
    options,
  };
}

export function readOptionSourceFromField(
  field: Partial<FormField> & Record<string, unknown>
): OptionSource | undefined {
  return normalizeOptionSource(
    field.optionSource ?? field['option_source']
  );
}

export function resolveFieldOptionSource(field: FormField): OptionSource | undefined {
  const direct = normalizeOptionSource(field.optionSource);

  if (direct?.type === 'dynamic') {
    return undefined;
  }

  if (direct) {
    return direct;
  }

  const inferred = readOptionSourceFromField(
    field as FormField & Record<string, unknown>
  );

  if (inferred?.type === 'dynamic') {
    return undefined;
  }

  return inferred;
}
