import { BrandPanel } from '@/app/(ui)/components/portal/signin/BrandPanel';
import { LoginModes } from '@/app/(ui)/components/portal/signin/LoginModes';

export default function LoginPage() {
  return (
    <div className="grid bg-white lg:min-h-[calc(100vh-92px)] lg:grid-cols-2">
      <BrandPanel />
      <section className="flex items-start justify-center bg-az-grey-bg px-5 py-12 lg:items-center lg:px-12">
        <div className="w-full max-w-[560px] rounded-[12px] bg-white p-6 shadow-card md:p-10">
          <h2 className="text-[24px] font-semibold text-az-navy">
            <span className="border-b-[3px] border-az-mint pb-0.5">Email sign-in</span>
          </h2>
          <div className="mt-6">
            <LoginModes />
          </div>
        </div>
      </section>
    </div>
  );
}
