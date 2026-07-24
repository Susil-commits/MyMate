import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

export default function PwaReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  useEffect(() => {
    if (offlineReady) {
      toast.success('App ready to work offline')
      setOfflineReady(false)
    } else if (needRefresh) {
      toast((t) => (
        <div className="flex items-center justify-between gap-4 w-full">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900">Update Available!</span>
            <span className="text-xs text-gray-500">A new version of MyMate is ready.</span>
          </div>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow active:scale-95"
            onClick={() => {
              updateServiceWorker(true)
              toast.dismiss(t.id)
            }}
          >
            Update
          </button>
        </div>
      ), { duration: Infinity, position: 'bottom-right', style: { padding: '16px', borderRadius: '16px', border: '1px solid #f3f4f6', boxShadow: '0 20px 40px rgba(0,0,0,0.08)' } })
    }
  }, [offlineReady, needRefresh, updateServiceWorker, setOfflineReady])

  return null
}
