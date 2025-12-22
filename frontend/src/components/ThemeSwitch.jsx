import { useState } from 'react'

export function ThemeSwitch() {
  const [isDark, setIsDark] = useState(() => {
    // Inicializa com o valor do localStorage ou preferência do sistema
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      if (saved) {
        return saved === 'dark'
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  // Efeito para aplicar a classe e salvar no localStorage
  useState(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark]) // Dependência é isDark

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    if (newIsDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 bg-slate-300 rounded-full transition-colors duration-200"
    >
      <div
        className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${isDark ? 'translate-x-7' : 'translate-x-1'
          }`}
      >
        <div className="flex items-center justify-center h-full">
          {isDark ? '🌙' : '☀️'}
        </div>
      </div>
    </button>
  )
}