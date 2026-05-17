"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Upload,
  Download,
  Trash2,
  FileText,
  CalendarIcon,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/context/AuthContext"
import {
  format,
  isWithinInterval,
  startOfDay,
  endOfDay,
  parseISO,
} from "date-fns"
import { cn } from "@/lib/utils"
import { documentService, CompanyDocument } from "@/services/documentService"

const RECORDS_PER_PAGE = 20

export default function DocumentsPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<CompanyDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({ from: undefined, to: undefined })

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [documentName, setDocumentName] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<CompanyDocument | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  const fetchDocuments = async () => {
    try {
      setIsLoading(true)
      const data = await documentService.getDocuments()
      setDocuments(data)
    } catch {
      toast({ title: "Error", description: "Failed to load documents.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchDocuments() }, [])

  useEffect(() => { setCurrentPage(1) }, [searchTerm, dateFilter])

  const filteredDocuments = documents.filter((doc) => {
    const nameMatch = doc.name.toLowerCase().includes(searchTerm.toLowerCase())
    let dateMatch = true
    if (dateFilter.from || dateFilter.to) {
      const docDate = parseISO(doc.created_at)
      if (dateFilter.from && dateFilter.to) {
        dateMatch = isWithinInterval(docDate, {
          start: startOfDay(dateFilter.from),
          end: endOfDay(dateFilter.to),
        })
      } else if (dateFilter.from) {
        dateMatch = docDate >= startOfDay(dateFilter.from)
      } else if (dateFilter.to) {
        dateMatch = docDate <= endOfDay(dateFilter.to)
      }
    }
    return nameMatch && dateMatch
  })

  const totalPages = Math.ceil(filteredDocuments.length / RECORDS_PER_PAGE)
  const currentPageDocs = filteredDocuments.slice(
    (currentPage - 1) * RECORDS_PER_PAGE,
    currentPage * RECORDS_PER_PAGE
  )

  const handleUpload = async () => {
    if (!documentName.trim() || !selectedFile) return
    setIsUploading(true)
    try {
      await documentService.uploadDocument(
        documentName.trim(),
        selectedFile,
        user?.email || ""
      )
      toast({ title: "Success", description: "Document uploaded successfully." })
      setUploadDialogOpen(false)
      setDocumentName("")
      setSelectedFile(null)
      fetchDocuments()
    } catch {
      toast({ title: "Error", description: "Failed to upload document.", variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return
    setIsDeleting(true)
    try {
      await documentService.deleteDocument(documentToDelete.id, documentToDelete.file_url)
      toast({ title: "Success", description: "Document deleted." })
      setDeleteDialogOpen(false)
      setDocumentToDelete(null)
      fetchDocuments()
    } catch {
      toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  const typeBadge = (type: string) => {
    if (type === "pdf")
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">PDF</Badge>
    if (type === "excel")
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Excel</Badge>
    if (type === "docs")
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Docs</Badge>
    return <Badge variant="outline">{type}</Badge>
  }

  const formatDate = (iso: string) => {
    const [year, month, day] = iso.split("T")[0].split("-")
    return `${month}/${day}/${year}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-800">
          Company Documents
        </h1>
        <Button
          className="bg-black hover:bg-gray-800 text-white w-full sm:w-auto"
          onClick={() => setUploadDialogOpen(true)}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 justify-start text-left font-normal w-[130px]",
                  !dateFilter.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFilter.from ? format(dateFilter.from, "MMM dd") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFilter.from}
                onSelect={(date) =>
                  setDateFilter((prev) => ({ ...prev, from: date }))
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 justify-start text-left font-normal w-[130px]",
                  !dateFilter.to && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFilter.to ? format(dateFilter.to, "MMM dd") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFilter.to}
                onSelect={(date) =>
                  setDateFilter((prev) => ({ ...prev, to: date }))
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {(dateFilter.from || dateFilter.to) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => setDateFilter({ from: undefined, to: undefined })}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-3" />
            {documents.length === 0 ? (
              <>
                <p className="text-lg font-medium text-gray-700">No documents uploaded yet</p>
                <p className="text-sm text-muted-foreground mt-1">Upload your first document using the button above.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-700">No documents match your filters</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or date range.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPageDocs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.name}</TableCell>
                      <TableCell>{typeBadge(doc.file_type)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.uploaded_by || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => window.open(doc.file_url, "_blank")}
                          >
                            <Download className="h-4 w-4" />
                            <span className="sr-only">Download</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => {
                              setDocumentToDelete(doc)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t space-y-2 sm:space-y-0">
              <p className="text-sm text-muted-foreground">
                Showing {currentPageDocs.length} of {filteredDocuments.length} documents
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open)
          if (!open) {
            setDocumentName("")
            setSelectedFile(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px] mx-4 w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a new company document. Supported formats: PDF, Excel, Word.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doc-name">
                Document Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="doc-name"
                placeholder="e.g. Q1 Fleet Report"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-file">
                File <span className="text-red-500">*</span>
              </Label>
              <Input
                id="doc-file"
                type="file"
                accept=".pdf,.xlsx,.xls,.docx,.doc"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!documentName.trim() || !selectedFile || isUploading}
              className="bg-black hover:bg-gray-800 text-white"
            >
              {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] mx-4 w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{documentToDelete?.name}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-black hover:bg-gray-800 text-white"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
