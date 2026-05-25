import { createClient } from '@/lib/supabase/client'

const supabaseClient = createClient()

export interface CompanyDocument {
  id: string
  name: string
  file_url: string | null
  file_type: string
  uploaded_by: string
  created_at: string
  password_hash: string | null
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function getFileType(file: File): string {
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
    uploadedBy: string,
    password?: string
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

    const passwordHash = password ? await hashPassword(password) : null

    const { data, error } = await supabaseClient
      .from('company_documents')
      .insert({
        name,
        file_url: urlData.publicUrl,
        file_type: fileType,
        uploaded_by: uploadedBy,
        password_hash: passwordHash,
      })
      .select()
      .single()
    if (error) {
      await supabaseClient.storage.from('company-documents').remove([storageData.path])
      throw error
    }
    return data
  },

  updateDocument: async (
    id: string,
    patch: {
      name?: string
      newFile?: File
      removeFile?: boolean
      passwordHash?: string | null
      currentFileUrl?: string | null
    }
  ): Promise<void> => {
    const dbPatch: Record<string, unknown> = {}

    if (patch.name !== undefined) dbPatch.name = patch.name
    if ('passwordHash' in patch) dbPatch.password_hash = patch.passwordHash

    let newStoragePath: string | null = null

    if (patch.removeFile) {
      dbPatch.file_url = null
      dbPatch.file_type = ''
    } else if (patch.newFile) {
      const fileType = getFileType(patch.newFile)
      const fileName = `${crypto.randomUUID()}-${patch.newFile.name}`
      const { data: storageData, error: storageError } = await supabaseClient.storage
        .from('company-documents')
        .upload(fileName, patch.newFile)
      if (storageError) throw storageError
      newStoragePath = storageData.path
      const { data: urlData } = supabaseClient.storage
        .from('company-documents')
        .getPublicUrl(storageData.path)
      dbPatch.file_url = urlData.publicUrl
      dbPatch.file_type = fileType
    }

    if (Object.keys(dbPatch).length > 0) {
      const { error } = await supabaseClient
        .from('company_documents')
        .update(dbPatch)
        .eq('id', id)
      if (error) {
        if (newStoragePath) {
          await supabaseClient.storage.from('company-documents').remove([newStoragePath])
        }
        throw error
      }
    }

    // Clean up old file after successful DB update
    if ((patch.removeFile || patch.newFile) && patch.currentFileUrl) {
      try {
        const url = new URL(patch.currentFileUrl)
        const filePath = url.pathname.split('/company-documents/')[1]
        if (filePath) {
          await supabaseClient.storage.from('company-documents').remove([filePath])
        }
      } catch {
        // Non-blocking — storage orphan acceptable
      }
    }
  },

  deleteDocument: async (id: string, fileUrl: string | null): Promise<void> => {
    if (fileUrl) {
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
          // invalid URL — skip storage deletion
        } else {
          throw e
        }
      }
    }
    const { error } = await supabaseClient
      .from('company_documents')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
