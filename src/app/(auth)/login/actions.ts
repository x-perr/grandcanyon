'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export interface LoginState {
  error?: string
  success?: boolean
}

export async function login(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validation
  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  // Attempt login
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Generic error message for security
    return { error: 'Invalid email or password' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
