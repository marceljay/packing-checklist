import { Link, Outlet } from 'react-router-dom';

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="text-xl">🧳</span>
            <span>Packing Checklist</span>
          </Link>
          <span className="ml-auto text-xs text-slate-400">private · offline · no account</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
