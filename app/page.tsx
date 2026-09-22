"use client";

import { useState } from "react";

import Link from "next/link";
import {
  ArrowRight,
  Search,
  Home,
  Users,
  ShieldCheck,
  CalendarDays,
  Wrench,
  PaintRoller,
  Droplets,
  Sparkles,
  Hammer,
  CheckCircle2,
  Star,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

const services = [
  {
    title: "AC Repair",
    subtitle: "Stay Cool Always",
    icon: Wrench,
    iconClass: "text-blue-600",
  },
  {
    title: "Painting",
    subtitle: "Fresh Looks",
    icon: PaintRoller,
    iconClass: "text-amber-500",
  },
  {
    title: "Plumbing",
    subtitle: "Fix It Right",
    icon: Droplets,
    iconClass: "text-blue-500",
  },
  {
    title: "Cleaning",
    subtitle: "A Healthier Home",
    icon: Sparkles,
    iconClass: "text-emerald-500",
  },
  {
    title: "Carpentry",
    subtitle: "Build & Repair",
    icon: Hammer,
    iconClass: "text-blue-600",
  },
];

const trustItems = [
  {
    title: "Verified",
    subtitle: "Professionals",
    icon: ShieldCheck,
  },
  {
    title: "Safe & Secure",
    subtitle: "Payments",
    icon: CheckCircle2,
  },
  {
    title: "Easy",
    subtitle: "Booking",
    icon: CalendarDays,
  },
  {
    title: "Trusted by",
    subtitle: "Thousands",
    icon: Users,
  },
];

const stats = [
  {
    value: "10K+",
    label: "Happy Customers",
    icon: "smile",
  },
  {
    value: "500+",
    label: "Verified Professionals",
    icon: "users",
  },
  {
    value: "1K+",
    label: "Services Completed",
    icon: "check",
  },
  {
    value: "4.8★",
    label: "Average Rating",
    icon: "star",
  },
];

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">

      {/* =========================================================
          NAVBAR
      ========================================================= */}

      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1700px] items-center justify-between px-4 sm:h-[82px] sm:px-6 lg:h-[86px] lg:px-12">

          {/* LOGO */}
          <Link
            href="/"
            onClick={closeMobileMenu}
            className="flex shrink-0 items-center gap-2.5 sm:gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-600 text-white shadow-lg shadow-blue-500/20 sm:h-[50px] sm:w-[50px] sm:rounded-[16px] lg:h-[54px] lg:w-[54px]">
              <Home size={24} strokeWidth={2.5} className="sm:h-7 sm:w-7" />
            </div>

            <div>
              <div className="text-[22px] font-extrabold leading-none tracking-[-0.04em] sm:text-[25px] lg:text-[27px]">
                <span className="text-slate-950">Home</span>
                <span className="text-blue-600">Mate</span>
              </div>

              <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.22em] text-slate-500 sm:text-[9px] lg:text-[10px] lg:tracking-[0.27em]">
                Home Services
              </p>
            </div>
          </Link>

          {/* DESKTOP NAVIGATION */}
          <nav className="hidden items-center gap-6 lg:flex xl:gap-9">
            <Link
              href="#services"
              className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-700 transition hover:text-blue-600 xl:text-[15px]"
            >
              Services
              <ChevronDown size={15} />
            </Link>

            <Link
              href="#how-it-works"
              className="text-[14px] font-semibold text-slate-700 transition hover:text-blue-600 xl:text-[15px]"
            >
              How It Works
            </Link>

            <Link
              href="#why-homemate"
              className="text-[14px] font-semibold text-slate-700 transition hover:text-blue-600 xl:text-[15px]"
            >
              Why HomeMate
            </Link>

            <Link
              href="#community"
              className="text-[14px] font-semibold text-slate-700 transition hover:text-blue-600 xl:text-[15px]"
            >
              Community
            </Link>

            <Link
              href="#contact"
              className="text-[14px] font-semibold text-slate-700 transition hover:text-blue-600 xl:text-[15px]"
            >
              Contact
            </Link>
          </nav>

          {/* DESKTOP ACTIONS + MOBILE TOGGLER */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">

            <button
              type="button"
              aria-label="Search"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-blue-50 hover:text-blue-600 sm:flex"
            >
              <Search size={21} />
            </button>

            <Link
              href="/login"
              className="hidden rounded-xl border border-blue-100 px-5 py-3 text-[14px] font-bold text-blue-600 transition hover:border-blue-200 hover:bg-blue-50 lg:block"
            >
              Sign In
            </Link>

            <Link
              href="/register"
              className="hidden items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[14px] font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 sm:flex"
            >
              Get Started
              <ArrowRight size={17} />
            </Link>

            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-white text-slate-800 shadow-sm transition hover:bg-blue-50 hover:text-blue-600 lg:hidden"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        <div
          className={`overflow-hidden border-t border-slate-100 bg-white transition-all duration-300 lg:hidden ${
            mobileMenuOpen
              ? "max-h-[520px] opacity-100"
              : "max-h-0 opacity-0"
          }`}
        >
          <nav className="mx-auto max-w-[1700px] px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-1">

              <Link
                href="#services"
                onClick={closeMobileMenu}
                className="flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-600"
              >
                Services
                <ChevronDown size={17} />
              </Link>

              <Link
                href="#how-it-works"
                onClick={closeMobileMenu}
                className="rounded-xl px-4 py-3.5 text-[15px] font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-600"
              >
                How It Works
              </Link>

              <Link
                href="#why-homemate"
                onClick={closeMobileMenu}
                className="rounded-xl px-4 py-3.5 text-[15px] font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-600"
              >
                Why HomeMate
              </Link>

              <Link
                href="#community"
                onClick={closeMobileMenu}
                className="rounded-xl px-4 py-3.5 text-[15px] font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-600"
              >
                Community
              </Link>

              <Link
                href="#contact"
                onClick={closeMobileMenu}
                className="rounded-xl px-4 py-3.5 text-[15px] font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-600"
              >
                Contact
              </Link>

              <div className="mt-2 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <Link
                  href="/login"
                  onClick={closeMobileMenu}
                  className="flex items-center justify-center rounded-xl border border-blue-100 px-4 py-3.5 text-[14px] font-bold text-blue-600 transition hover:bg-blue-50"
                >
                  Sign In
                </Link>

                <Link
                  href="/register"
                  onClick={closeMobileMenu}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                >
                  Get Started
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </nav>
        </div>
      </header>


      {/* =========================================================
          HERO
      ========================================================= */}

      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#f7fbff] to-[#edf7ff]">

        <div className="pointer-events-none absolute -left-32 top-24 h-96 w-96 rounded-full bg-blue-100/50 blur-3xl" />

        <div className="pointer-events-none absolute right-0 top-0 h-[520px] w-[520px] rounded-full bg-sky-100/60 blur-3xl" />

        <div className="relative mx-auto grid min-h-0 max-w-[1700px] grid-cols-1 items-center gap-8 px-4 py-10 sm:px-6 sm:py-12 md:py-14 lg:min-h-[710px] lg:grid-cols-[0.94fr_1.06fr] lg:gap-8 lg:px-12 lg:py-14">

          {/* =====================================================
              LEFT HERO CONTENT
          ===================================================== */}

          <div className="relative z-10 mx-auto w-full max-w-[760px] lg:mx-0">

            {/* TOP BADGE */}

            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-blue-600 shadow-sm sm:mb-6 sm:px-4 sm:text-[11px]">

              <Home size={14} fill="currentColor" />

              Your home. Our support. Always.

            </div>


            {/* HEADING */}

            <h1 className="max-w-[760px] text-[42px] font-black leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-[54px] md:text-[62px] lg:text-[68px] xl:text-[74px]">

              Everything you need to

              <span className="block text-blue-600">
                manage your home
              </span>

            </h1>


            {/* DESCRIPTION */}

            <p className="mt-6 max-w-[700px] text-[15px] leading-7 text-slate-600 sm:mt-7 sm:text-[17px] sm:leading-8 md:text-[18px]">

              From finding trusted professionals to managing your property and
              booking services, HomeMate brings your home needs together in one
              place.

            </p>


            {/* SEARCH */}

            <div className="mt-7 flex w-full max-w-[710px] items-center rounded-2xl border border-blue-100 bg-white p-1.5 shadow-[0_14px_45px_rgba(37,99,235,0.12)] sm:mt-8">

              <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5 sm:gap-3 sm:px-4">

                <Search
                  className="shrink-0 text-slate-500"
                  size={21}
                />

                <input
                  type="text"
                  aria-label="Search services"
                  placeholder="Search for services (e.g. AC repair, Cleaning, Plumbing...)"
                  className="w-full min-w-0 bg-transparent py-3 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 sm:text-[14px] md:text-[15px]"
                />

              </div>

              <button
                type="button"
                className="shrink-0 rounded-xl bg-blue-600 px-4 py-3.5 text-[13px] font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 sm:px-6 sm:text-[14px] md:px-7 md:text-[15px]"
              >
                Search
              </button>

            </div>


            {/* HERO BUTTONS */}

            <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-4">

              <Link
                href="/register"
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 sm:w-auto sm:px-7 sm:py-4 sm:text-[15px]"
              >
                Get Started

                <ArrowRight size={18} />
              </Link>


              <Link
                href="#services"
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-blue-200 bg-white px-6 py-3.5 text-[14px] font-bold text-slate-800 transition hover:border-blue-400 hover:text-blue-600 sm:w-auto sm:px-7 sm:py-4 sm:text-[15px]"
              >
                Explore Services

                <ArrowRight size={18} />
              </Link>

            </div>


            {/* TRUST STRIP */}

            <div className="mt-8 grid max-w-[760px] grid-cols-2 gap-y-5 border-t border-blue-100 pt-6 sm:mt-10 sm:grid-cols-4 sm:gap-0 sm:pt-7">

              {trustItems.map((item, index) => {

                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className={`flex items-center gap-3 sm:px-4 ${index !== 0
                        ? "sm:border-l sm:border-blue-100"
                        : ""
                      }`}
                  >

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">

                      <Icon size={22} />

                    </div>

                    <div className="text-[13px] leading-5">

                      <p className="font-bold text-slate-800">
                        {item.title}
                      </p>

                      <p className="font-medium text-slate-500">
                        {item.subtitle}
                      </p>

                    </div>

                  </div>
                );

              })}

            </div>

          </div>


          {/* =====================================================
              RIGHT HERO IMAGE
          ===================================================== */}

          <div className="relative mx-auto mt-3 min-h-[460px] w-full max-w-[760px] sm:min-h-[540px] md:min-h-[590px] lg:mt-0 lg:min-h-[620px]">

            {/* BLUE BACKGROUND */}

            {/* BLUE BACKGROUND */}

            <div className="absolute bottom-[5%] left-[8%] h-32 w-32 rounded-full bg-sky-200/50 blur-3xl sm:h-44 sm:w-44" />


            {/* HANDWRITTEN TEXT */}

            <div className="absolute left-[8%] top-[1%] z-20 hidden -rotate-3 sm:block lg:left-[10%] lg:top-[4%]">

              <p className="font-serif text-[20px] font-semibold leading-6 text-slate-800 md:text-[23px] md:leading-7 lg:text-[25px]">

                A Better
                <br />

                Home for a
                <br />

                Brighter Tomorrow

              </p>

              <div className="ml-5 mt-1 h-1 w-24 -rotate-6 rounded-full bg-blue-500" />

            </div>


            {/* HOUSE IMAGE */}

            <div className="absolute inset-x-[2%] bottom-[14%] top-[9%] overflow-hidden rounded-[44%_44%_20%_20%] border border-white/70 bg-transparent shadow-2xl shadow-blue-200/30 sm:inset-x-[4%] sm:bottom-[12%] sm:top-[12%]">

              <img
                src="/landing page.png"
                alt="Modern HomeMate house"
                className="h-full w-full object-cover object-center"
              />

            </div>


            {/* TRUSTED PROFESSIONALS */}

            <div className="absolute right-[0%] top-[5%] z-30 flex items-center gap-2 rounded-2xl bg-white px-3 py-3 shadow-xl shadow-slate-300/30 sm:right-[1%] sm:top-[6%] sm:gap-3 sm:px-5 sm:py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 sm:h-12 sm:w-12">
                <Users size={25} />
              </div>

              <div>

                <p className="text-[14px] font-extrabold text-slate-800">
                  Trusted
                </p>

                <p className="text-[14px] font-medium text-slate-600">
                  Professionals
                </p>

              </div>

            </div>


            {/* SERVICE CARDS */}

            <div className="absolute bottom-[-3%] left-[0%] right-[0%] z-30 grid grid-cols-2 gap-2 sm:bottom-[-5%] sm:left-[2%] sm:grid-cols-5 sm:gap-3">

              {services.map((service) => {

                const Icon = service.icon;

                return (
                  <Link
                    key={service.title}
                    href="/services"
                    className="group rounded-xl border border-white bg-white/95 px-2 py-3 text-center shadow-xl shadow-slate-300/25 backdrop-blur-md transition hover:-translate-y-1 sm:rounded-2xl sm:px-3 sm:py-4"
                  >

                    <Icon
                      size={25}
                      className={`mx-auto ${service.iconClass} transition group-hover:scale-110`}
                      strokeWidth={2.2}
                    />

                    <p className="mt-1.5 text-[11px] font-extrabold text-slate-800 sm:mt-2 sm:text-[13px]">
                      {service.title}
                    </p>

                    <p className="mt-0.5 text-[9px] font-medium text-slate-500 sm:text-[10px]">
                      {service.subtitle}
                    </p>

                  </Link>
                );

              })}

            </div>


           

          </div>

        </div>

      </section>


      {/* =========================================================
          STATS
      ========================================================= */}

      <section className="relative z-20 mx-auto -mt-1 max-w-[1500px] px-4 sm:px-6 lg:px-12">

        <div className="grid overflow-hidden rounded-[24px] border border-blue-50 bg-white/95 shadow-[0_20px_60px_rgba(37,99,235,0.10)] backdrop-blur sm:rounded-[30px] md:grid-cols-2 lg:grid-cols-4">

          {stats.map((stat, index) => (

            <div
              key={stat.label}
              className={`flex items-center gap-3 px-4 py-5 sm:gap-4 sm:px-8 sm:py-7 ${index !== 0
                  ? "border-t border-blue-50 md:border-l md:border-t-0"
                  : ""
                }`}
            >

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">

                {stat.icon === "users" && (
                  <Users size={24} />
                )}

                {stat.icon === "check" && (
                  <CheckCircle2 size={24} />
                )}

                {stat.icon === "star" && (
                  <Star size={24} fill="currentColor" />
                )}

                {stat.icon === "smile" && (
                  <span className="text-[23px] font-bold">
                    ☺
                  </span>
                )}

              </div>

              <div>

                <p className="text-[25px] font-black leading-none tracking-tight text-slate-900">
                  {stat.value}
                </p>

                <p className="mt-1 text-[13px] font-medium text-slate-500">
                  {stat.label}
                </p>

              </div>

            </div>

          ))}

        </div>

      </section>


      {/* =========================================================
          SERVICES
      ========================================================= */}

      <section
        id="services"
        className="bg-white py-16 sm:py-20 lg:py-24"
      >

        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-12">

          <div className="max-w-2xl">

            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-600">
              HomeMate Platform
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
              Everything for your home
            </h2>

            <p className="mt-4 text-[16px] leading-7 text-slate-500">
              Access the services and features you need from one convenient
              platform.
            </p>

          </div>


          <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">

            {[
              {
                href: "/services",
                icon: Wrench,
                title: "Home Services",
                text: "Find professionals for repairs, maintenance, cleaning, installation and other home services.",
              },
              {
                href: "/professionals",
                icon: Search,
                title: "Nearby Professionals",
                text: "Discover available professionals near your property and find the right person for your needs.",
              },
              {
                href: "/bookings",
                icon: CalendarDays,
                title: "Easy Service Booking",
                text: "Schedule services conveniently and keep track of your bookings from your account.",
              },
              {
                href: "/properties",
                icon: Home,
                title: "Property Management",
                text: "Manage your properties, keep information organized and stay connected with your home services.",
              },
              {
                href: "/professionals",
                icon: ShieldCheck,
                title: "Trusted Professionals",
                text: "Connect with service professionals and discover the right expertise for your home.",
              },
              {
                href: "/community",
                icon: Users,
                title: "Home Community",
                text: "Connect with your community, share experiences and discover useful home-related information.",
              },
            ].map((item) => {

              const Icon = item.icon;

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-[24px] border border-slate-100 bg-white p-6 sm:rounded-[28px] sm:p-8 shadow-[0_10px_35px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-[0_20px_50px_rgba(37,99,235,0.10)]"
                >

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">

                    <Icon size={26} />

                  </div>

                  <h3 className="mt-7 text-xl font-extrabold text-slate-900">
                    {item.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {item.text}
                  </p>

                  <div className="mt-6 flex items-center gap-2 text-sm font-bold text-blue-600">

                    Explore

                    <ArrowRight
                      size={16}
                      className="transition group-hover:translate-x-1"
                    />

                  </div>

                </Link>
              );

            })}

          </div>

        </div>

      </section>


      {/* =========================================================
          HOW IT WORKS
      ========================================================= */}

      <section
        id="how-it-works"
        className="bg-[#f7fbff] py-16 sm:py-20 lg:py-24"
      >

        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-12">

          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-600">
            How It Works
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
            Getting things done is simple
          </h2>


          <div className="mt-10 grid gap-5 sm:mt-14 sm:gap-8 md:grid-cols-3">

            {[
              [
                "01",
                "Create your account",
                "Register as a customer, professional or business and create your HomeMate profile.",
              ],
              [
                "02",
                "Find what you need",
                "Discover home services and professionals that match your requirements.",
              ],
              [
                "03",
                "Book and manage",
                "Book services, manage your property and keep track of your home-service activity.",
              ],
            ].map(([number, title, text]) => (

              <div
                key={number}
                className="rounded-[24px] border border-blue-100 bg-white p-6 shadow-sm sm:rounded-[28px] sm:p-8"
              >

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-500/20">
                  {number}
                </div>

                <h3 className="mt-7 text-xl font-extrabold">
                  {title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {text}
                </p>

              </div>

            ))}

          </div>

        </div>

      </section>


      {/* =========================================================
          WHY HOMEmate
      ========================================================= */}

      <section
        id="why-homemate"
        className="bg-white py-16 sm:py-20 lg:py-24"
      >

        <div className="mx-auto grid max-w-[1500px] gap-10 px-4 sm:gap-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-12">

          <div>

            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-600">
              Why HomeMate
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              One platform for your everyday home needs
            </h2>

            <p className="mt-5 max-w-xl text-[16px] leading-7 text-slate-600">
              HomeMate brings homeowners, professionals and businesses together
              so that home services are easier to discover, book and manage.
            </p>

          </div>


          <div className="grid gap-4 sm:grid-cols-2">

            {[
              [
                CheckCircle2,
                "Trusted Connections",
                "Discover professionals for different home-service needs.",
              ],
              [
                Search,
                "Nearby Services",
                "Find professionals and services around your property.",
              ],
              [
                CalendarDays,
                "Convenient Booking",
                "Manage your service bookings from one place.",
              ],
              [
                ShieldCheck,
                "Secure Platform",
                "Your account and service activity stay protected.",
              ],
            ].map(([Icon, title, text]) => {

              const FeatureIcon = Icon as typeof CheckCircle2;

              return (
                <div
                  key={title as string}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-6"
                >

                  <FeatureIcon
                    size={23}
                    className="text-blue-600"
                  />

                  <h3 className="mt-5 font-extrabold">
                    {title as string}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {text as string}
                  </p>

                </div>
              );

            })}

          </div>

        </div>

      </section>


      {/* =========================================================
          COMMUNITY CTA
      ========================================================= */}

      <section
        id="community"
        className="bg-blue-600"
      >

        <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20 md:flex-row md:items-center md:justify-between lg:px-12">

          <div className="max-w-2xl">

            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-100">
              HomeMate Community
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
              Make your home easier to manage.
            </h2>

            <p className="mt-4 text-[15px] leading-7 text-blue-100">
              Create your HomeMate account and start exploring services,
              professionals and home-management features.
            </p>

          </div>


          <Link
            href="/register"
            className="inline-flex shrink-0 items-center justify-center gap-3 rounded-xl bg-white px-7 py-4 text-sm font-extrabold text-blue-600 shadow-xl transition hover:bg-blue-50"
          >

            Create Account

            <ArrowRight size={17} />

          </Link>

        </div>

      </section>


      {/* =========================================================
          FOOTER
      ========================================================= */}

      <footer
        id="contact"
        className="bg-slate-950"
      >

        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-12">

          <div>

            <div className="text-xl font-black text-white">

              Home
              <span className="text-blue-500">
                Mate
              </span>

            </div>

            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Home Services Platform
            </p>

          </div>


          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} HomeMate. All rights reserved.
          </p>

        </div>

      </footer>

    </main>
  );
}