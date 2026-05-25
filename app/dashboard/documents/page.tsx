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
  Trash2,
  FileText,
  CalendarIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  Lock,
  X,
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/context/AuthContext"
import {
  format,
  isWithinInterval,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  parseISO,
} from "date-fns"
import { cn } from "@/lib/utils"
import { documentService, CompanyDocument, hashPassword } from "@/services/documentService"

const RECORDS_PER_PAGE = 20

export default function DocumentsPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<CompanyDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [documentName, setDocumentName] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadPassword, setUploadPassword] = useState('')
  const [uploadPasswordShow, setUploadPasswordShow] = useState(false)

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [documentToEdit, setDocumentToEdit] = useState<CompanyDocument | null>(null)
  const [editName, setEditName] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<CompanyDocument | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Password prompt
  type PromptAction = 'view' | 'edit' | 'delete'
  const [promptState, setPromptState] = useState<{
    open: boolean
    doc: CompanyDocument | null
    action: PromptAction | null
    value: string
    error: string
    showPassword: boolean
  }>({ open: false, doc: null, action: null, value: '', error: '', showPassword: false })

  // Expanded edit state
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editFileRemoved, setEditFileRemoved] = useState(false)
  const [editPassword, setEditPassword] = useState('')
  const [editPasswordShow, setEditPasswordShow] = useState(false)
  const [editPasswordAction, setEditPasswordAction] = useState<'keep' | 'change' | 'remove'>('keep')

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

  const triggerAction = (doc: CompanyDocument, action: PromptAction) => {
    if (doc.password_hash) {
      setPromptState({ open: true, doc, action, value: '', error: '', showPassword: false })
    } else {
      executeAction(doc, action)
    }
  }

  const executeAction = (doc: CompanyDocument, action: PromptAction) => {
    if (action === 'view') handleView(doc)
    else if (action === 'edit') {
      setDocumentToEdit(doc)
      setEditName(doc.name)
      setEditFile(null)
      setEditFileRemoved(false)
      setEditPassword('')
      setEditPasswordAction('keep')
      setEditDialogOpen(true)
    }
    else if (action === 'delete') {
      setDocumentToDelete(doc)
      setDeleteDialogOpen(true)
    }
  }

  const handlePromptConfirm = async () => {
    const { doc, action, value } = promptState
    if (!doc || !action) return
    try {
      const hash = await hashPassword(value)
      if (hash !== doc.password_hash) {
        setPromptState(prev => ({ ...prev, error: 'Incorrect password', value: '' }))
        return
      }
      setPromptState({ open: false, doc: null, action: null, value: '', error: '', showPassword: false })
      executeAction(doc, action)
    } catch {
      setPromptState(prev => ({ ...prev, error: 'Could not verify password, try again' }))
    }
  }

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

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / RECORDS_PER_PAGE))
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
        user?.email || "",
        uploadPassword || undefined
      )
      toast({ title: "Success", description: "Document uploaded successfully." })
      setUploadDialogOpen(false)
      setDocumentName("")
      setSelectedFile(null)
      setUploadPassword("")
      setUploadPasswordShow(false)
      fetchDocuments()
    } catch {
      toast({ title: "Error", description: "Failed to upload document.", variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  const handleView = (doc: CompanyDocument) => {
    if (!doc.file_url) return
    if (doc.file_type === "pdf") {
      window.open(doc.file_url, "_blank")
    } else {
      const a = document.createElement("a")
      a.href = doc.file_url
      a.download = doc.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const handleEditSave = async () => {
    if (!documentToEdit || !editName.trim()) return
    setIsSavingEdit(true)
    try {
      const patch: Parameters<typeof documentService.updateDocument>[1] = {}

      if (editName.trim() !== documentToEdit.name) patch.name = editName.trim()

      if (editFileRemoved) {
        patch.removeFile = true
        patch.currentFileUrl = documentToEdit.file_url
      } else if (editFile) {
        patch.newFile = editFile
        patch.currentFileUrl = documentToEdit.file_url
      }

      if (editPasswordAction === 'remove') {
        patch.passwordHash = null
      } else if (editPasswordAction === 'change' && editPassword) {
        patch.passwordHash = await hashPassword(editPassword)
      } else if (!documentToEdit.password_hash && editPassword) {
        patch.passwordHash = await hashPassword(editPassword)
      }

      await documentService.updateDocument(documentToEdit.id, patch)
      toast({ title: "Success", description: "Document updated." })
      setEditDialogOpen(false)
      setDocumentToEdit(null)
      fetchDocuments()
    } catch {
      toast({ title: "Error", description: "Failed to update document.", variant: "destructive" })
    } finally {
      setIsSavingEdit(false)
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

  const getFilenameFromUrl = (url: string): string => {
    try {
      const parts = new URL(url).pathname.split('/')
      const raw = parts[parts.length - 1] || 'file'
      const withoutUuid = raw.replace(/^[0-9a-f-]{36}-/, '')
      return withoutUuid || raw
    } catch {
      return 'file'
    }
  }

  const setToday = () => {
    const today = new Date()
    setDateFilter({ from: today, to: today })
  }

  const clearFilters = () => {
    setSearchTerm("")
    setDateFilter({ from: undefined, to: undefined })
  }

  const hasActiveFilters = searchTerm || dateFilter.from || dateFilter.to

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
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

      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 shrink-0">
            <Filter className="h-4 w-4" />
            <span>Filters:</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-500">Search:</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 w-48"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-500">From:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 justify-start text-left font-normal w-[120px]",
                    !dateFilter.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {dateFilter.from ? format(dateFilter.from, "MMM dd") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFilter.from}
                  onSelect={(date) => setDateFilter((prev) => ({ ...prev, from: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-500">To:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 justify-start text-left font-normal w-[120px]",
                    !dateFilter.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {dateFilter.to ? format(dateFilter.to, "MMM dd") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFilter.to}
                  onSelect={(date) => setDateFilter((prev) => ({ ...prev, to: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-sm font-normal shrink-0"
            onClick={setToday}
          >
            Today
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-sm font-normal text-gray-500 shrink-0"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-gray-100 rounded-full p-5 mb-4">
              <FileText className="h-10 w-10 text-gray-400" />
            </div>
            {documents.length === 0 ? (
              <>
                <p className="text-lg font-semibold text-gray-800 mb-1">No documents uploaded yet</p>
                <p className="text-sm text-gray-500 mb-6 max-w-sm">
                  Keep your company files organized by uploading your first document.
                </p>
                <Button
                  className="bg-black hover:bg-gray-800 text-white px-6"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Your First Document
                </Button>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-gray-800 mb-1">No documents match your filters</p>
                <p className="text-sm text-gray-500">Try adjusting your search or date range.</p>
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
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          {doc.name}
                          {doc.password_hash && (
                            <Lock className="h-3.5 w-3.5 text-gray-400 shrink-0" title="Password protected" />
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{typeBadge(doc.file_type)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.uploaded_by || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                            onClick={() => triggerAction(doc, 'edit')}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                            onClick={() => triggerAction(doc, 'view')}
                            title={doc.file_type === "pdf" ? "View" : "Download"}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => triggerAction(doc, 'delete')}
                            title="Delete"
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

      {/* Password Prompt Dialog */}
      <Dialog
        open={promptState.open}
        onOpenChange={(open) => {
          if (!open) setPromptState({ open: false, doc: null, action: null, value: '', error: '', showPassword: false })
        }}
      >
        <DialogContent className="sm:max-w-[380px] mx-4 w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> This document is protected
            </DialogTitle>
            <DialogDescription>
              Enter the password to {promptState.action} &ldquo;{promptState.doc?.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <div className="relative">
              <Input
                type={promptState.showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={promptState.value}
                onChange={(e) => setPromptState(prev => ({ ...prev, value: e.target.value, error: '' }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePromptConfirm() }}
                className={cn("pr-9", promptState.error && "border-red-500")}
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 w-7 p-0"
                onClick={() => setPromptState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                type="button"
              >
                {promptState.showPassword
                  ? <EyeOff className="h-4 w-4 text-gray-400" />
                  : <Eye className="h-4 w-4 text-gray-400" />}
              </Button>
            </div>
            {promptState.error && (
              <p className="text-sm text-red-500">{promptState.error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromptState({ open: false, doc: null, action: null, value: '', error: '', showPassword: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePromptConfirm}
              disabled={!promptState.value}
              className="bg-black hover:bg-gray-800 text-white"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open)
          if (!open) {
            setDocumentName("")
            setSelectedFile(null)
            setUploadPassword("")
            setUploadPasswordShow(false)
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
            <div className="space-y-2">
              <Label htmlFor="upload-password">
                Password <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="upload-password"
                  type={uploadPasswordShow ? 'text' : 'password'}
                  placeholder="Leave blank for no protection"
                  value={uploadPassword}
                  onChange={(e) => setUploadPassword(e.target.value)}
                  className="pr-9"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setUploadPasswordShow(p => !p)}
                >
                  {uploadPasswordShow
                    ? <EyeOff className="h-4 w-4 text-gray-400" />
                    : <Eye className="h-4 w-4 text-gray-400" />}
                </Button>
              </div>
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

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setDocumentToEdit(null)
            setEditName("")
            setEditFile(null)
            setEditFileRemoved(false)
            setEditPassword('')
            setEditPasswordAction('keep')
            setEditPasswordShow(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px] mx-4 w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>Update the name, file, or password for this document.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">Document Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleEditSave() }}
              />
            </div>

            {/* Attachment */}
            <div className="space-y-2">
              <Label>Attachment</Label>
              {editFileRemoved ? (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border text-sm text-gray-500">
                  <span className="flex-1">No attachment</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                    onClick={() => setEditFileRemoved(false)}>
                    Undo
                  </Button>
                </div>
              ) : editFile ? (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border text-sm">
                  <span className="truncate flex-1 text-gray-700">{editFile.name}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                    onClick={() => setEditFile(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border text-sm">
                  <span className="truncate flex-1 text-gray-600">
                    {documentToEdit?.file_url
                      ? getFilenameFromUrl(documentToEdit.file_url)
                      : 'No attachment'}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2 shrink-0"
                    onClick={() => document.getElementById('edit-file-input')?.click()}>
                    Replace
                  </Button>
                  {documentToEdit?.file_url && (
                    <Button variant="ghost" size="sm"
                      className="h-6 text-xs px-2 text-red-500 hover:text-red-600 shrink-0"
                      onClick={() => setEditFileRemoved(true)}>
                      Remove
                    </Button>
                  )}
                </div>
              )}
              <input
                id="edit-file-input"
                type="file"
                accept=".pdf,.xlsx,.xls,.docx,.doc"
                className="hidden"
                onChange={(e) => {
                  setEditFile(e.target.files?.[0] || null)
                  e.target.value = ''
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label>Password</Label>
              {documentToEdit?.password_hash ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {(['keep', 'change', 'remove'] as const).map(opt => (
                      <Button
                        key={opt}
                        variant={editPasswordAction === opt ? 'default' : 'outline'}
                        size="sm"
                        type="button"
                        className={cn(
                          "h-7 text-xs capitalize",
                          editPasswordAction === opt && "bg-black text-white hover:bg-gray-800"
                        )}
                        onClick={() => setEditPasswordAction(opt)}
                      >
                        {opt === 'keep' ? 'Keep' : opt === 'change' ? 'Change' : 'Remove'}
                      </Button>
                    ))}
                  </div>
                  {editPasswordAction === 'change' && (
                    <div className="relative">
                      <Input
                        type={editPasswordShow ? 'text' : 'password'}
                        placeholder="New password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="pr-9"
                      />
                      <Button variant="ghost" size="sm" type="button"
                        className="absolute right-1 top-1 h-7 w-7 p-0"
                        onClick={() => setEditPasswordShow(p => !p)}>
                        {editPasswordShow
                          ? <EyeOff className="h-4 w-4 text-gray-400" />
                          : <Eye className="h-4 w-4 text-gray-400" />}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Input
                    type={editPasswordShow ? 'text' : 'password'}
                    placeholder="Add password (optional)"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="pr-9"
                  />
                  <Button variant="ghost" size="sm" type="button"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setEditPasswordShow(p => !p)}>
                    {editPasswordShow
                      ? <EyeOff className="h-4 w-4 text-gray-400" />
                      : <Eye className="h-4 w-4 text-gray-400" />}
                  </Button>
                </div>
              )}
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={!editName.trim() || isSavingEdit}
              className="bg-black hover:bg-gray-800 text-white"
            >
              {isSavingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
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
