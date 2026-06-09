import { createClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">SOURCE<span className="text-orange-500">HQ</span></h1>
        <span className="text-sm text-gray-500">{session.user.email}</span>
      </div>
      <div className="px-8 py-10">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to SOURCE HQ</h2>
        <p className="text-gray-500">Your workspace is ready. Clients and campaigns coming soon.</p>
      </div>
    </main>
  )
}