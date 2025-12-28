import { Header } from './Header';

export function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Header />
      <main className="py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
