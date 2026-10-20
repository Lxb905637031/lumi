import type { AccountDeletionRequest, DataExportRequest, CursorPage } from '@lumi/contracts';
import { request } from '../../services/http-client';

export function getDeletionRequest(): Promise<AccountDeletionRequest | null> {
  return request('/account/privacy/deletion');
}

export function createDeletionRequest(): Promise<AccountDeletionRequest> {
  return request('/account/privacy/deletion', { method: 'POST', data: {} });
}

export function cancelDeletionRequest(): Promise<AccountDeletionRequest> {
  return request('/account/privacy/deletion', { method: 'DELETE' });
}

export function listDataExports(cursor?: string): Promise<CursorPage<DataExportRequest>> {
  return request(`/account/privacy/exports?limit=10${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
}

export function createDataExport(): Promise<DataExportRequest> {
  return request('/account/privacy/exports', { method: 'POST', data: { confirmation: 'EXPORT_MY_DATA' } });
}

export function downloadDataExport(id: string) {
  return request<{ id: string; exportedAt: string | null; data: Record<string, unknown> }>(
    `/account/privacy/exports/${id}/download`,
  );
}
