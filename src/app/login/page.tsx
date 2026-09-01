import { login } from './actions';
import SubmitButton from '@/components/SubmitButton';

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="md:flex-[0_0_44%] bg-navy text-white p-6 sm:p-8 md:p-12 flex flex-col justify-between relative overflow-hidden min-h-[260px] md:min-h-screen">
        <div
          className="absolute right-[-40px] bottom-[-60px] font-display font-semibold leading-none pointer-events-none"
          style={{ fontSize: 340, color: 'rgba(255,255,255,0.035)' }}
        >
          D
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DCIPHERS logo" className="w-9 h-auto" />
            <div className="font-bold text-sm tracking-wide">DCIPHERS</div>
          </div>
          <h1 className="font-display text-2xl md:text-3xl leading-tight mb-3.5 max-w-[340px]">
            Purchase orders, issued precisely.
          </h1>
          <p className="text-[13px] text-white/60 max-w-[320px] leading-relaxed">
            The internal system of record for every PO — numbered correctly, calculated
            correctly, never lost in someone&apos;s Downloads folder.
          </p>
        </div>
        <div className="relative z-10">
          {['Auto-numbered by series, gap-free', 'GST & totals calculated, never typed', 'Every edit logged, every PO searchable'].map((f, i) => (
            <div key={f} className="flex items-baseline gap-2.5 text-[12.5px] text-white/65 py-1.5 border-t border-white/10">
              <span className="text-gold text-[11px]">{String(i + 1).padStart(2, '0')}</span>
              {f}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 bg-bg flex items-center justify-center p-6">
        <form action={login} className="w-full max-w-[360px]">
          <h1 className="font-display text-xl mb-1">Sign in</h1>
          <p className="text-xs text-muted mb-6">Internal access only. Contact your Admin for an account.</p>
          {searchParams.error === 'session_expired' && (
            <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mb-3.5">
              That invite link expired. Ask your Admin to send a new one.
            </div>
          )}
          {searchParams.error === 'invite_link_invalid' && (
            <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mb-3.5">
              That link isn't valid or has already been used.
            </div>
          )}
          {searchParams.error === 'db' && (
            <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mb-3.5">
              We could not complete sign-in right now. Please try again in a moment or contact your administrator.
            </div>
          )}
          {searchParams.error && !['session_expired', 'invite_link_invalid', 'db'].includes(searchParams.error) && (
            <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mb-3.5">
              Incorrect email or password.
            </div>
          )}
          <label className="field-label">Email</label>
          <input className="input mb-3.5" type="email" name="email" required />
          <label className="field-label">Password</label>
          <input className="input mb-5" type="password" name="password" required />
          <SubmitButton className="btn btn-primary w-full justify-center" pendingText="Signing in...">Sign in</SubmitButton>
        </form>
      </div>
    </div>
  );
}
