"use client";

import { Paperclip, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { openStoredFile } from "@/lib/storage-url";
import type { LoanDocument } from "@/services/loanService";

function DocumentRow(props: { name: string; onOpen?: () => void; onRemove: () => void }) {
  const { t } = useTranslation("financials");
  return (
    <li className="flex items-center gap-1">
      <Paperclip className="h-3 w-3 shrink-0" />
      {props.onOpen ? (
        <button
          type="button"
          onClick={props.onOpen}
          className="truncate text-blue-600 hover:underline"
        >
          {props.name}
        </button>
      ) : (
        <span className="truncate">{props.name}</span>
      )}
      <button
        type="button"
        aria-label={t("loans.form.removeDocument", "Remove document")}
        onClick={props.onRemove}
        className="ml-auto text-muted-foreground hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/** Documents already on the loan plus files picked in this session. */
export function LoanDocumentsField(props: {
  documents: LoanDocument[];
  onDocumentsChange: (documents: LoanDocument[]) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
}) {
  const { t } = useTranslation("financials");
  const { documents, onDocumentsChange, files, onFilesChange } = props;
  return (
    <div className="space-y-2">
      <Label htmlFor="loan-document">{t("loans.form.documents", "Supporting documents")}</Label>
      <Input
        id="loan-document"
        type="file"
        multiple
        accept="image/*,application/pdf"
        onChange={(e) => {
          onFilesChange([...files, ...Array.from(e.target.files || [])]);
          // Reset so the picker can add more files, including the same one again.
          e.target.value = "";
        }}
      />
      <ul className="space-y-1 text-xs">
        {documents.map((doc) => (
          <DocumentRow
            key={doc.url}
            name={doc.name}
            onOpen={() => openStoredFile(doc.url)}
            onRemove={() => onDocumentsChange(documents.filter((d) => d.url !== doc.url))}
          />
        ))}
        {files.map((file, i) => (
          <DocumentRow
            key={`${file.name}-${i}`}
            name={file.name}
            onRemove={() => onFilesChange(files.filter((_, j) => j !== i))}
          />
        ))}
      </ul>
    </div>
  );
}
