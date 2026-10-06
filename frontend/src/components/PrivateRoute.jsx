import { useEffect, useRef } from 'react'
import { SignedIn, SignedOut, SignIn, useUser } from '@clerk/clerk-react'
import { useLearningStore } from '@/stores/learningStore'
import { identifyUser, resetAnalytics } from '@/lib/analytics'

const HAS_CLERK = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

export default function PrivateRoute({ children, isConfigured = HAS_CLERK }) {
  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] p-6 text-center">
        <div>
          <div className="text-[15px] font-semibold text-[var(--text-1)]">Sign in required</div>
          <div className="mt-1 text-[13px] text-[var(--text-2)]">Authentication is not configured in this environment.</div>
        </div>
      </div>
    )
  }

  return <ConfiguredPrivateRoute>{children}</ConfiguredPrivateRoute>
}

function ConfiguredPrivateRoute({ children }) {
  const { user } = useUser()
  const resetLearning = useLearningStore((state) => state.resetLearning)
  const previousUserId = useRef(user?.id ?? null)

  useEffect(() => {
    const userId = user?.id ?? null
    if (!userId || (previousUserId.current && previousUserId.current !== userId)) {
      resetLearning()
    }
    previousUserId.current = userId
  }, [resetLearning, user?.id])

  useEffect(() => {
    if (user?.id) {
      identifyUser(user.id, { auth_provider: 'clerk' })
    } else {
      resetAnalytics()
    }
  }, [user?.id])

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="min-h-screen bg-gray-50 dark:bg-[#101922] flex items-center justify-center p-4">
          <SignIn routing="hash" />
        </div>
      </SignedOut>
    </>
  )
}
