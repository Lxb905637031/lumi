import type { CursorPage, QuotaLedgerEntry, QuotaSummary } from '@lumi/contracts';
import { request } from '../../services/http-client';

export function getQuota(): Promise<QuotaSummary> {
  return request('/quota');
}

export function listQuotaLedger(cursor?: string): Promise<CursorPage<QuotaLedgerEntry>> {
  return request('/quota/ledger?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
}
