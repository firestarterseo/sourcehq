import { createClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export async function GET() {
  const supabase = createClient()
  
  const { data } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (data.url) {
    redirect(data.url)
  }

  redirect('/')
}