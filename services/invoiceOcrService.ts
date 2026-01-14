export type InvoiceOcrMappedItem = {
  date: string;
  item_name: string;
  description: string;
  quantity: number;
  amount_unit: number;
  total_cost: number;
};

export type InvoiceOcrResult = {
  invoice_date: string;
  items: InvoiceOcrMappedItem[];
  raw?: unknown;
};

async function postInvoiceOcr(formData: FormData): Promise<InvoiceOcrResult> {
  const res = await fetch("/api/invoice-ocr", {
    method: "POST",
    body: formData,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof json?.error === "string" ? json.error : "Invoice OCR failed";
    const details = typeof json?.details === "string" ? json.details : "";
    throw new Error(details ? `${message}: ${details}` : message);
  }

  return json as InvoiceOcrResult;
}

export const invoiceOcrService = {
  async extractInvoiceItems(file: File): Promise<InvoiceOcrResult>;
  async extractInvoiceItems(files: File[]): Promise<InvoiceOcrResult>;
  async extractInvoiceItems(fileOrFiles: File | File[]): Promise<InvoiceOcrResult> {
    const formData = new FormData();

    if (Array.isArray(fileOrFiles)) {
      fileOrFiles.forEach((f) => formData.append("files", f));
    } else {
      formData.append("file", fileOrFiles);
    }

    return await postInvoiceOcr(formData);
  },
};

