import { useEffect, useRef } from 'react'

export default function QRScanner({ onScan, onClose }) {
  const regionId = 'qr-scanner-region'
  const scannerRef = useRef(null)

  useEffect(() => {
    let scanner = null

    async function startScanner() {
      const { Html5Qrcode } = await import('html5-qrcode')
      scanner = new Html5Qrcode(regionId)
      scannerRef.current = scanner

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            onScan(decoded)
          },
          () => {}
        )
      } catch (err) {
        console.warn('Camera error:', err)
      }
    }

    startScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-sm">
        <div className="text-center mb-4">
          <div className="text-2xl mb-1">📷</div>
          <h2 className="text-lg font-bold text-white">掃描 QR Code</h2>
          <p className="text-gray-500 text-sm mt-1">對準房主顯示的 QR Code</p>
        </div>
        <div id={regionId} className="rounded-xl overflow-hidden" />
        <button
          onClick={onClose}
          className="w-full mt-4 bg-[#21262d] hover:bg-[#30363d] text-gray-300 font-medium py-2.5 rounded-xl transition"
        >
          取消
        </button>
      </div>
    </div>
  )
}
