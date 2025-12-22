export function Logo() {
  return (
    <div className="w-full h-full">
      <img
        src="/logo.jpg"
        alt="TheraMind Logo"
        className="w-full h-full object-contain"
        onError={(e) => {
          e.target.style.display = 'none'
          if (e.target.nextSibling) {
            e.target.nextSibling.style.display = 'block'
          }
        }}
      />
      <div
        className="w-full h-full bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm"
        style={{ display: 'none' }}
      >
        TM
      </div>
    </div>
  )
}