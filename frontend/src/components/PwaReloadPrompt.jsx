import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

export default function PwaReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
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
        <div className="flex items-center gap-4 flex-col sm:flex-row">
          <span className="text-sm font-medium">New version available!</span>
          <button
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition"
            onClick={() => {
              updateServiceWorker(true)
              toast.dismiss(t.id)
            }}
          >
            Reload
          </button>
        </div>
      ), { duration: Infinity, position: 'bottom-right' })
    }
  }, [offlineReady, needRefresh, updateServiceWorker, setOfflineReady])

  return null
}
