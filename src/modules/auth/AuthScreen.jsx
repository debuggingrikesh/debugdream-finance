import { Chrome } from 'lucide-react'

export default function AuthScreen({ onSignIn, error }) {
  return (
    <div className="h-screen bg-[#0a0a0a] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#E8192C]/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-[#E8192C]/3 blur-[80px]" />
        {/* Grid lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(42,42,42,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(42,42,42,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#2a2a2a] flex items-center justify-center mb-5 shadow-[0_0_40px_rgba(232,25,44,0.15)]">
            <div className="flex flex-col leading-none">
              <span className="font-display font-black text-white text-xl">D</span>
            </div>
          </div>
          <div className="text-center">
            <div className="font-display font-black text-3xl text-white tracking-tight leading-none">
              debug<span className="text-[#E8192C]">dream</span>
            </div>
            <div className="text-[#444] text-sm font-body mt-2">Finance · Internal</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 shadow-[0_25px_50px_rgba(0,0,0,0.6)]">
          <h1 className="font-display font-bold text-xl text-white mb-1">Sign in</h1>
          <p className="text-sm text-[#555] font-body mb-6">
            Single-user access · Rikesh Karmacharya
          </p>

          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm font-body">{error}</p>
            </div>
          )}

          <button
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-gray-800 rounded-xl font-body font-semibold text-sm transition-all duration-150 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            {/* Google SVG */}
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-5 text-center text-xs text-[#333] font-body">
            Access restricted to authorized email only
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#2a2a2a] mt-6 font-body">
          debugdream.com · Kathmandu, Nepal · 2082 BS
        </p>
      </div>
    </div>
  )
}
