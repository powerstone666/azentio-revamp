export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-az-grey-bg">
      <div className="w-full max-w-md rounded-[12px] bg-white p-8 shadow-card">
        <h1 className="text-2xl font-semibold text-az-navy">Sign in to azentio.ai</h1>
        <p className="mt-2 text-az-text-muted">Email OTP authentication coming in M1.</p>
        <form className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="you@azentio.com"
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-az-text"
            disabled
          />
          <button
            type="submit"
            disabled
            className="w-full rounded-[50px] bg-az-navy px-6 py-3 font-medium text-white opacity-50"
          >
            Send code
          </button>
        </form>
      </div>
    </div>
  );
}