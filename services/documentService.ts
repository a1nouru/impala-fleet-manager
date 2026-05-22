import { createClient } from '@/lib/supabase/client'

const supabaseClient = createClient()

export interface CompanyDocument {
  id: string
  name: string
  file_url: string
  file_type: string
  uploaded_by: string
  created_at: string
}

const getFileType = (file: File): string => {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'pdf'
  if (['xlsx', 'xls'].includes(ext)) return 'excel'
  if (['docx', 'doc'].includes(ext)) return 'docs'
  return 'other'
}

export const documentService = {
  getDocuments: async (): Promise<CompanyDocument[]> => {
    const { data, error } = await supabaseClient
      .from('company_documents')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  uploadDocument: async (
    name: string,
    file: File,
    uploadedBy: string
  ): Promise<CompanyDocument> => {
    const fileType = getFileType(file)
    const fileName = `${crypto.randomUUID()}-${file.name}`

    const { data: storageData, error: storageError } = await supabaseClient.storage
      .from('company-documents')
      .upload(fileName, file)
    if (storageError) throw storageError

    const { data: urlData } = supabaseClient.storage
      .from('company-documents')
      .getPublicUrl(storageData.path)

    const { data, error } = await supabaseClient
      .from('company_documents')
      .insert({
        name,
        file_url: urlData.publicUrl,
        file_type: fileType,
        uploaded_by: uploadedBy,
      })
      .select()
      .single()
    if (error) {
      await supabaseClient.storage.from('company-documents').remove([storageData.path])
      throw error
    }
    return data
  },

  updateDocumentName: async (id: string, name: string): Promise<void> => {
    const { error } = await supabaseClient
      .from('company_documents')
      .update({ name })
      .eq('id', id)
    if (error) throw error
  },

  deleteDocument: async (id: string, fileUrl: string): Promise<void> => {
    try {
      const url = new URL(fileUrl)
      const filePath = url.pathname.split('/company-documents/')[1]
      if (filePath) {
        const { error: storageError } = await supabaseClient.storage
          .from('company-documents')
          .remove([filePath])
        if (storageError) throw storageError
      }
    } catch (e) {
      if (e instanceof TypeError) {
        // invalid URL — skip storage deletion, proceed with DB delete
      } else {
        throw e
      }
    }
    const { error } = await supabaseClient
      .from('company_documents')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
