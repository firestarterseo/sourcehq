import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://sourcehq.vercel.app/auth/callback',
    },
  })

  if (data.url) {
    redirect(data.url)
  }

  redirect('/')
}