import { setPassword } from './actions';
import SubmitButton from '@/components/SubmitButton';

const ERROR_MESSAGES: Record<string, string> = {
  too_short: 'Password must be at least 8 characters.',
  mismatch: "Passwords don't match.",
  update_failed: 'Something went wrong setting your password — try again.',
};

export default function SetPasswordPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="md:flex-[0_0_44%] bg-navy text-white p-6 sm:p-8 md:p-12 flex flex-col justify-between relative overflow-hidden min-h-[240px] md:min-h-screen">
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
          <h1 className="font-display text-2xl md:text-3xl leading-tight mb-3.5 max-w-[340px]">Welcome aboard.</h1>
          <p className="text-[13px] text-white/60 max-w-[320px] leading-relaxed">
            Set a password to finish setting up your account.
          </p>
        </div>
      </div>
      <div className="flex-1 bg-bg flex items-center justify-center p-6">
        <form action={setPassword} className="w-full max-w-[360px]">
          <h1 className="font-display text-xl mb-1">Set your password</h1>
          <p className="text-xs text-muted mb-6">This is the password you'll use to sign in from now on.</p>
          {searchParams.error && (
            <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mb-3.5">
              {ERROR_MESSAGES[searchParams.error] ?? 'Something went wrong.'}
            </div>
          )}
          <label className="field-label">New password</label>
          <input className="input mb-3.5" type="password" name="password" minLength={8} required />
          <label className="field-label">Confirm password</label>
          <input className="input mb-5" type="password" name="confirmPassword" minLength={8} required />
          <SubmitButton className="btn btn-primary w-full justify-center" pendingText="Setting password...">
            Set Password &amp; Continue
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
