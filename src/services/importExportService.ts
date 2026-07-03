import { ApiClientError, apiClient } from "./apiClient";

export type ImportType = "students" | "courses" | "teachers" | "classes" | "credit-balances" | "schedules" | "lesson-records";
export type ExportType =
  | "students"
  | "courses"
  | "teachers"
  | "classes"
  | "credit-accounts"
  | "credit-transactions"
  | "schedules"
  | "lesson-records"
  | "leave-makeup"
  | "parent-reports";

export type ImportPreviewRow = {
  rowNumber: number;
  status: "valid" | "invalid";
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
};

export type ImportPreviewResult = {
  importBatchId: string;
  batchId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  errors: Array<{ rowNumber: number; message: string }>;
  previewRows: ImportPreviewRow[];
};

export type ImportBatch = {
  id: string;
  importBatchId: string;
  type: string;
  typeLabel: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  status: string;
  createdBy?: string;
  createdAt: string;
  confirmedAt?: string;
  rollbackAt?: string;
  previewRows?: ImportPreviewRow[];
  createdIds?: Array<{ type: string; id: string }>;
};

type ImportBatchListResponse = ImportBatch[] | { batches?: ImportBatch[]; total?: number };

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function download(path: string, fileName: string) {
  const token = localStorage.getItem("astralink.auth.token");
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api"}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `下载失败：${response.status}`);
  }
  downloadBlob(await response.blob(), fileName);
}

export const importExportService = {
  downloadTemplate(type: ImportType) {
    return download(`/import/templates/${type}`, `${type}-template.xlsx`);
  },

  async preview(type: ImportType, file: File): Promise<ImportPreviewResult> {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);
    return apiClient.request<ImportPreviewResult>("/import/preview", { method: "POST", body: formData, headers: {} });
  },

  confirm(batchId: string) {
    return apiClient.request<{ importBatchId: string; createdCount: number; status: string }>(`/import/confirm/${batchId}`, { method: "POST" });
  },

  listBatches() {
    return apiClient
      .request<ImportBatchListResponse>("/import/batches")
      .then((result) => (Array.isArray(result) ? result : result.batches ?? []))
      .catch((error) => {
        if (error instanceof ApiClientError && error.status === 404) return [];
        throw error;
      });
  },

  getBatch(id: string) {
    return apiClient.request<ImportBatch>(`/import/batches/${id}`);
  },

  rollback(id: string) {
    return apiClient.request<{ importBatchId: string; rollbackCount: number; status: string }>(`/import/batches/${id}/rollback`, { method: "POST" });
  },

  exportData(type: ExportType, query: Record<string, string>) {
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value.trim() !== ""));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return download(`/export/${type}${suffix}`, `${type}.xlsx`);
  },
};
