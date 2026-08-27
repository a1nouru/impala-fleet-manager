import { createClient } from '@/lib/supabase/client'

const supabaseClient = createClient()

export const LOAN_ACCOUNTS = ['Caixa Angola'] as const
export type LoanAccount = (typeof LOAN_ACCOUNTS)[number]

export interface Loan {
  id: string
  borrower_name: string
  borrower_contact: string | null
  amount: number
  issuing_account: string
  purpose: string | null
  issue_date: string
  due_date: string | null
  status: 'open' | 'closed'
  closed_at: string | null
  closed_by: string | null
  repaid_amount: number | null
  repayment_date: string | null
  slip_url: string | null
  slip_name: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LoanInput {
  borrower_name: string
  borrower_contact?: string | null
  amount: number
  issuing_account: string
  purpose?: string | null
  issue_date: string
  due_date?: string | null
  notes?: string | null
}

const BUCKET = 'loan-slips'

function storagePathFromUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl)
    return url.pathname.split(`/${BUCKET}/`)[1] || null
  } catch {
    return null
  }
}

async function uploadSlip(file: File): Promise<{ url: string; name: string; path: string }> {
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, '_')}`
  const { data, error } = await supabaseClient.storage.from(BUCKET).upload(path, file)
  if (error) throw error
  const { data: urlData } = supabaseClient.storage.from(BUCKET).getPublicUrl(data.path)
  return { url: urlData.publicUrl, name: file.name, path: data.path }
}

export const loanService = {
  /**
   * Password check runs entirely in Postgres (SECURITY DEFINER function against
   * a table no client role can read). The hash never reaches the browser.
   */
  verifyPassword: async (password: string): Promise<boolean> => {
    const { data, error } = await supabaseClient.rpc('verify_app_password', {
      p_key: 'loans',
      p_password: password,
    })
    if (error) throw error
    return data === true
  },

  getLoans: async (): Promise<Loan[]> => {
    const { data, error } = await supabaseClient
      .from('loans')
      .select('*')
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as Loan[]
  },

  createLoan: async (input: LoanInput, createdBy: string): Promise<Loan> => {
    const { data, error } = await supabaseClient
      .from('loans')
      .insert({ ...input, created_by: createdBy })
      .select()
      .single()
    if (error) throw error
    return data as Loan
  },

  updateLoan: async (id: string, patch: Partial<LoanInput>): Promise<void> => {
    const { error } = await supabaseClient.from('loans').update(patch).eq('id', id)
    if (error) throw error
  },

  /** Close a loan with the bank slip that confirms repayment. */
  closeLoan: async (
    loan: Loan,
    args: {
      slipFile?: File | null
      repaymentDate: string
      repaidAmount?: number | null
      notes?: string | null
      closedBy: string
    }
  ): Promise<void> => {
    let slip: { url: string; name: string; path: string } | null = null
    if (args.slipFile) {
      slip = await uploadSlip(args.slipFile)
    }

    const patch: Record<string, unknown> = {
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: args.closedBy,
      repayment_date: args.repaymentDate,
      repaid_amount: args.repaidAmount ?? loan.amount,
    }
    if (args.notes !== undefined) patch.notes = args.notes
    if (slip) {
      patch.slip_url = slip.url
      patch.slip_name = slip.name
    }

    const { error } = await supabaseClient.from('loans').update(patch).eq('id', loan.id)
    if (error) {
      if (slip) await supabaseClient.storage.from(BUCKET).remove([slip.path])
      throw error
    }

    // Replace an older slip only after the row is safely updated.
    if (slip && loan.slip_url) {
      const oldPath = storagePathFromUrl(loan.slip_url)
      if (oldPath) await supabaseClient.storage.from(BUCKET).remove([oldPath])
    }
  },

  /** Re-open a closed loan (keeps the slip on file unless removed explicitly). */
  reopenLoan: async (id: string): Promise<void> => {
    const { error } = await supabaseClient
      .from('loans')
      .update({
        status: 'open',
        closed_at: null,
        closed_by: null,
        repayment_date: null,
        repaid_amount: null,
      })
      .eq('id', id)
    if (error) throw error
  },

  deleteLoan: async (loan: Loan): Promise<void> => {
    const { error } = await supabaseClient.from('loans').delete().eq('id', loan.id)
    if (error) throw error
    if (loan.slip_url) {
      const path = storagePathFromUrl(loan.slip_url)
      if (path) await supabaseClient.storage.from(BUCKET).remove([path])
    }
  },
}
