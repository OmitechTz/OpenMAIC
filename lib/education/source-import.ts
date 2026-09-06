import { useSettingsStore } from '@/lib/store/settings';

/** Runs only after the learner chooses a file and clicks Import. */
export async function importSourceText(file: File, signal?: AbortSignal): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Use a source smaller than 20 MB.');
  if (/\.(txt|md)$/i.test(file.name)) return file.text();
  const { pdfProviderId, pdfProvidersConfig } = useSettingsStore.getState();
  const provider = pdfProvidersConfig[pdfProviderId];
  const data = new FormData();
  data.append('file', file);
  data.append('providerId', pdfProviderId);
  if (provider?.apiKey) data.append('apiKey', provider.apiKey);
  if (provider?.baseUrl) data.append('baseUrl', provider.baseUrl);
  if (provider?.accessKeyId) data.append('accessKeyId', provider.accessKeyId);
  if (provider?.accessKeySecret) data.append('accessKeySecret', provider.accessKeySecret);
  const response = await fetch('/api/extract-document', { method: 'POST', body: data, signal });
  const body = await response.json();
  if (!response.ok || !body.success || typeof body.data?.text !== 'string')
    throw new Error(
      'The source could not be extracted. Check Document Parsing settings or paste an excerpt.',
    );
  if (!body.data.text.trim())
    throw new Error('No readable text found. Use an OCR-capable parser or paste an excerpt.');
  return body.data.text;
}
