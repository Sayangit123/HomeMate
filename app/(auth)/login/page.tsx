import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f4f7fb] text-slate-950">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[44%_56%]">

        {/* =========================
            LEFT BANNER
        ========================== */}
        <section
          className="relative order-2 min-h-[520px] overflow-hidden bg-cover bg-center lg:order-1 lg:min-h-screen"
          style={{
            backgroundImage: "url('/images/homemate-home.png')",
          }}
        >
          {/* NO BLACK OVERLAY */}

          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-32 -top-32 h-[430px] w-[430px] rounded-full border border-white/30" />

          <div className="pointer-events-none absolute -bottom-48 -left-48 h-[500px] w-[500px] rounded-full border border-white/30" />

          {/* Content */}
          <div className="relative z-10 flex min-h-[520px] flex-col px-6 py-8 sm:px-10 sm:py-10 lg:min-h-screen lg:px-10 xl:px-14">

            {/* Logo */}
            <div className="flex items-center gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white/10 backdrop-blur-sm sm:h-14 sm:w-14">

                <svg
                  viewBox="0 0 64 64"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="h-7 w-7 text-white sm:h-8 sm:w-8"
                >
                  <path d="M8 29L32 9l24 20" />
                  <path d="M14 27v29h36V27" />
                  <path d="M25 56V38h14v18" />
                </svg>

              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg sm:text-3xl">
                  HomeMate
                </h2>

                <p className="mt-1 text-[8px] font-medium uppercase tracking-[0.3em] text-white drop-shadow-md sm:text-[9px]">
                  Home Services Platform
                </p>
              </div>

            </div>


            {/* Main content */}
            <div className="my-auto max-w-xl py-12">

              <div className="mb-6 flex items-center gap-4">

                <span className="h-px w-12 bg-[#e6c38e]" />

                <span className="text-[9px] font-bold uppercase tracking-[0.32em] text-white drop-shadow-md sm:text-[10px]">
                  Welcome Back
                </span>

              </div>


              <h2 className="text-5xl font-bold leading-[1.02] tracking-tight text-white drop-shadow-lg sm:text-6xl xl:text-[68px]">

                Your Home

                <span className="block text-[#f0c98e] drop-shadow-lg">
                  Your Community.
                </span>

              </h2>


              <p className="mt-7 max-w-lg text-sm leading-6 text-white drop-shadow-md sm:text-base sm:leading-7">
                Sign in to connect with trusted professionals, manage your
                home services, and continue your HomeMate experience.
              </p>


              {/* Features */}
              <div className="mt-9 space-y-5">

                <Feature
                  title="Trusted Professionals"
                  description="Connect with verified service providers"
                  icon="✓"
                  className="bg-emerald-500"
                />

                <Feature
                  title="Everything for Your Home"
                  description="Discover and manage home services"
                  icon="⊕"
                  className="bg-blue-500"
                />

                <Feature
                  title="Simple & Convenient"
                  description="Manage everything from one place"
                  icon="▣"
                  className="bg-indigo-500"
                />

                <Feature
                  title="Built for Everyone"
                  description="Homeowners, professionals and businesses"
                  icon="●"
                  className="bg-orange-500"
                />

              </div>

            </div>


            {/* Bottom slogan */}
            <div>

              <div className="mb-4 h-px w-12 bg-[#e6c38e]" />

              <p className="font-serif text-2xl italic text-white drop-shadow-md sm:text-3xl">
                A Better Home
              </p>

              <p className="ml-7 font-serif text-2xl italic text-[#f0c98e] drop-shadow-md sm:text-3xl">
                A Happier You.
              </p>

              <div className="mt-5 flex gap-2">
                <span className="h-1.5 w-7 rounded-full bg-white" />
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>

            </div>

          </div>
        </section>


        {/* =========================
            RIGHT LOGIN FORM
        ========================== */}
        <section className="relative order-1 min-w-0 overflow-x-hidden bg-[#f4f7fb] lg:order-2">

          {/* Soft background glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_8%,rgba(37,99,235,0.14),transparent_32%)]" />

          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[850px] flex-col px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-10">

            {/* Create account */}
            <div className="mb-5 flex justify-end">

              <p className="text-[11px] text-slate-500 sm:text-sm">
                New to HomeMate?{" "}

                <a
                  href="/register"
                  className="font-bold text-blue-600 transition hover:text-blue-800"
                >
                  Create account →
                </a>
              </p>

            </div>


            {/* Login card */}
            <div className="my-auto overflow-hidden rounded-[22px] border border-white bg-white shadow-[0_30px_100px_rgba(15,23,42,0.12)] sm:rounded-[28px]">

              {/* Header */}
              <div className="border-b border-slate-100 px-6 py-8 sm:px-8 sm:py-9 lg:px-10">

                <div className="flex items-center gap-3">

                  <span className="h-1 w-10 rounded-full bg-blue-600" />

                  <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500 sm:text-[10px]">
                    Welcome Back
                  </span>

                </div>


                <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">

                  Sign in to

                  <span className="block text-blue-600">
                    HomeMate.
                  </span>

                </h1>


                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">
                  Access your account and continue managing everything that
                  matters to your home.
                </p>

              </div>


              {/* Form */}
              <div className="px-6 py-7 sm:px-8 sm:py-9 lg:px-10">

                {/* Security information */}
                <div className="mb-7 flex items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                    🔐
                  </div>

                  <div>

                    <p className="text-sm font-bold text-slate-950">
                      Secure account access
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Your data is protected and securely handled.
                    </p>

                  </div>

                </div>


                {/* YOUR EXISTING LOGIN LOGIC */}
                <LoginForm />

              </div>

            </div>

          </div>
        </section>

      </div>
    </main>
  );
}


/* =========================
   FEATURE
========================= */

function Feature({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description: string;
  icon: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-4">

      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-lg sm:h-12 sm:w-12 ${className}`}
      >
        {icon}
      </div>

      <div>

        <p className="text-sm font-bold text-white drop-shadow-md sm:text-base">
          {title}
        </p>

        <p className="mt-1 text-xs text-white drop-shadow-md sm:text-sm">
          {description}
        </p>

      </div>

    </div>
  );
}