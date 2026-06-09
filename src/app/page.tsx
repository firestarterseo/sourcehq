import { createClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-md px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SOURCE <span className="text-orange-500">HQ</span></h1>
          <p className="text-gray-500 text-sm">Sign in to your workspace</p>
        </div>
        <a href="/auth/login" className="flex items-center justify-center w-full border border-gray-200 rounded-lg px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Continue with Google</a>
      </div>
    </main>
  )
}