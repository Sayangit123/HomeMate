"use client";

import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  Building2,
  Search,
  ShieldCheck,
  Users,
  Wrench,
  Home,
  CheckCircle2,
  MapPin,
  Clock3,
  Sparkles,
} from "lucide-react";


export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* =========================================================
          NAVBAR
      ========================================================= */}

      <header
        className="
          sticky
          top-0
          z-50
          border-b
          border-slate-200
          bg-white
        "
      >
        <div
          className="
            mx-auto
            flex
            h-[74px]
            max-w-[1700px]
            items-center
            justify-between
            px-6
            lg:px-10
          "
        >

          {/* LOGO */}

          <Link
            href="/"
            className="
              flex
              items-center
              gap-3
            "
          >

            <div
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-2xl
                bg-orange-500
                text-white
                shadow-lg
                shadow-orange-500/20
              "
            >
              <Home
                size={25}
                strokeWidth={2}
              />
            </div>

            <div>

              <div
                className="
                  text-[26px]
                  font-black
                  leading-none
                  tracking-tight
                "
              >
                <span className="text-slate-900">
                  Home
                </span>

                <span className="text-orange-500">
                  Mate
                </span>
              </div>

              <p
                className="
                  mt-1
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.28em]
                  text-slate-400
                "
              >
                Home Services
              </p>

            </div>

          </Link>


          {/* NAVIGATION */}

          <nav
            className="
              hidden
              items-center
              gap-10
              lg:flex
            "
          >

            <Link
              href="#services"
              className="
                text-[16px]
                font-semibold
                text-slate-600
                transition
                hover:text-orange-500
              "
            >
              Services
            </Link>

            <Link
              href="#how-it-works"
              className="
                text-[16px]
                font-semibold
                text-slate-600
                transition
                hover:text-orange-500
              "
            >
              How It Works
            </Link>

            <Link
              href="#why-homemate"
              className="
                text-[16px]
                font-semibold
                text-slate-600
                transition
                hover:text-orange-500
              "
            >
              Why HomeMate
            </Link>

            <Link
              href="#community"
              className="
                text-[16px]
                font-semibold
                text-slate-600
                transition
                hover:text-orange-500
              "
            >
              Community
            </Link>

          </nav>


          {/* ACTIONS */}

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            <Link
              href="/login"
              className="
                hidden
                px-5
                py-3
                text-[16px]
                font-semibold
                text-slate-600
                transition
                hover:text-orange-500
                sm:block
              "
            >
              Sign In
            </Link>

            <Link
              href="/register"
              className="
                flex
                items-center
                gap-3
                rounded-2xl
                bg-orange-500
                px-6
                py-4
                text-[15px]
                font-bold
                text-white
                shadow-lg
                shadow-orange-500/20
                transition-all
                duration-200
                hover:bg-orange-600
                hover:shadow-xl
              "
            >
              Get Started

              <ArrowRight
                size={18}
              />
            </Link>

          </div>

        </div>
      </header>


      {/* =========================================================
          HERO
      ========================================================= */}

      <section
        className="
          border-b
          border-slate-200
          bg-slate-50
        "
      >

        <div
          className="
            mx-auto
            max-w-[1700px]
            px-6
            pb-16
            pt-14
            lg:px-10
            lg:pb-20
            lg:pt-16
          "
        >

          <div
            className="
              max-w-[850px]
            "
          >

            <div
              className="
                mb-5
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-orange-100
                bg-orange-50
                px-4
                py-2
                text-[11px]
                font-bold
                uppercase
                tracking-wider
                text-orange-500
              "
            >

              <Sparkles
                size={13}
              />

              Your home. One platform.

            </div>


            <h1
              className="
                max-w-[850px]
                text-5xl
                font-black
                leading-[1.05]
                tracking-tight
                text-slate-950
                md:text-6xl
                lg:text-[66px]
              "
            >
              Everything you need
              to manage your home
            </h1>


            <p
              className="
                mt-6
                max-w-[850px]
                text-lg
                leading-8
                text-slate-600
              "
            >
              From finding trusted professionals to
              managing your property and booking
              services, HomeMate brings your home
              needs together in one place.
            </p>


            {/* HERO BUTTONS */}

            <div
              className="
                mt-8
                flex
                flex-wrap
                gap-4
              "
            >

              <Link
                href="/register"
                className="
                  flex
                  items-center
                  gap-3
                  rounded-xl
                  bg-orange-500
                  px-7
                  py-4
                  text-sm
                  font-bold
                  text-white
                  shadow-lg
                  shadow-orange-500/20
                  transition
                  hover:bg-orange-600
                "
              >
                Get Started

                <ArrowRight
                  size={17}
                />
              </Link>


              <Link
                href="#services"
                className="
                  flex
                  items-center
                  gap-3
                  rounded-xl
                  border
                  border-slate-300
                  bg-white
                  px-7
                  py-4
                  text-sm
                  font-bold
                  text-slate-700
                  transition
                  hover:border-orange-300
                  hover:text-orange-500
                "
              >
                Explore Services

                <ArrowRight
                  size={17}
                />
              </Link>

            </div>

          </div>

        </div>

      </section>


      {/* =========================================================
          SERVICES / FEATURE CARDS
      ========================================================= */}

      <section
        id="services"
        className="
          bg-slate-50
        "
      >

        <div
          className="
            mx-auto
            max-w-[1700px]
            px-6
            py-16
            lg:px-10
            lg:py-20
          "
        >

          {/* SECTION HEADING */}

          <div
            className="
              mb-10
            "
          >

            <p
              className="
                mb-2
                text-xs
                font-bold
                uppercase
                tracking-[0.2em]
                text-orange-500
              "
            >
              HomeMate Platform
            </p>

            <h2
              className="
                text-3xl
                font-black
                tracking-tight
                text-slate-950
                md:text-4xl
              "
            >
              Everything for your home
            </h2>

            <p
              className="
                mt-3
                max-w-2xl
                text-sm
                leading-6
                text-slate-500
              "
            >
              Access the services and features you
              need from one convenient platform.
            </p>

          </div>


          {/* =====================================================
              CARDS
          ===================================================== */}

          <div
            className="
              grid
              grid-cols-1
              gap-7
              md:grid-cols-2
              xl:grid-cols-3
            "
          >

            {/* ===================================================
                01 — HOME SERVICES
            =================================================== */}

            <Link
              href="/services"
              className="
                group
                block
                rounded-[28px]
                border
                border-slate-200
                bg-white
                p-10
                transition-all
                duration-300
                hover:-translate-y-1
                hover:border-orange-200
                hover:shadow-xl
                hover:shadow-slate-200/50
              "
            >

              <div
                className="
                  mb-8
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-orange-50
                  text-orange-500
                  transition-all
                  duration-300
                  group-hover:bg-orange-500
                  group-hover:text-white
                "
              >
                <Wrench
                  size={28}
                  strokeWidth={1.8}
                />
              </div>


              <h3
                className="
                  text-xl
                  font-bold
                  text-slate-950
                "
              >
                Home Services
              </h3>


              <p
                className="
                  mt-3
                  max-w-[400px]
                  text-sm
                  leading-6
                  text-slate-600
                "
              >
                Find professionals for repairs,
                maintenance, cleaning, installation
                and other home services.
              </p>


              <div
                className="
                  mt-7
                  flex
                  items-center
                  gap-2
                  text-sm
                  font-bold
                  text-orange-500
                  opacity-0
                  transition-all
                  duration-300
                  group-hover:translate-x-1
                  group-hover:opacity-100
                "
              >
                Explore Services

                <ArrowRight
                  size={16}
                />
              </div>

            </Link>


            {/* ===================================================
                02 — NEARBY PROFESSIONALS
            =================================================== */}

            <Link
              href="/professionals"
              className="
                group
                block
                rounded-[28px]
                border
                border-slate-200
                bg-white
                p-10
                transition-all
                duration-300
                hover:-translate-y-1
                hover:border-orange-200
                hover:shadow-xl
                hover:shadow-slate-200/50
              "
            >

              <div
                className="
                  mb-8
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-orange-50
                  text-orange-500
                  transition-all
                  duration-300
                  group-hover:bg-orange-500
                  group-hover:text-white
                "
              >
                <Search
                  size={28}
                  strokeWidth={1.8}
                />
              </div>


              <h3
                className="
                  text-xl
                  font-bold
                  text-slate-950
                "
              >
                Nearby Professionals
              </h3>


              <p
                className="
                  mt-3
                  max-w-[400px]
                  text-sm
                  leading-6
                  text-slate-600
                "
              >
                Discover available professionals
                near your property and find the
                right person for your needs.
              </p>


              <div
                className="
                  mt-7
                  flex
                  items-center
                  gap-2
                  text-sm
                  font-bold
                  text-orange-500
                  opacity-0
                  transition-all
                  duration-300
                  group-hover:translate-x-1
                  group-hover:opacity-100
                "
              >
                Find Professionals

                <ArrowRight
                  size={16}
                />
              </div>

            </Link>


            {/* ===================================================
                03 — SERVICE BOOKING
            =================================================== */}

            <Link
              href="/bookings"
              className="
                group
                block
                rounded-[28px]
                border
                border-slate-200
                bg-white
                p-10
                transition-all
                duration-300
                hover:-translate-y-1
                hover:border-orange-200
                hover:shadow-xl
                hover:shadow-slate-200/50
              "
            >

              <div
                className="
                  mb-8
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-orange-50
                  text-orange-500
                  transition-all
                  duration-300
                  group-hover:bg-orange-500
                  group-hover:text-white
                "
              >
                <CalendarDays
                  size={28}
                  strokeWidth={1.8}
                />
              </div>


              <h3
                className="
                  text-xl
                  font-bold
                  text-slate-950
                "
              >
                Easy Service Booking
              </h3>


              <p
                className="
                  mt-3
                  max-w-[400px]
                  text-sm
                  leading-6
                  text-slate-600
                "
              >
                Schedule services conveniently
                and keep track of your bookings
                from your account.
              </p>


              <div
                className="
                  mt-7
                  flex
                  items-center
                  gap-2
                  text-sm
                  font-bold
                  text-orange-500
                  opacity-0
                  transition-all
                  duration-300
                  group-hover:translate-x-1
                  group-hover:opacity-100
                "
              >
                Book a Service

                <ArrowRight
                  size={16}
                />
              </div>

            </Link>


            {/* ===================================================
                04 — PROPERTY MANAGEMENT
            =================================================== */}

            <Link
              href="/properties"
              className="
                group
                block
                rounded-[28px]
                border
                border-slate-200
                bg-white
                p-10
                transition-all
                duration-300
                hover:-translate-y-1
                hover:border-orange-200
                hover:shadow-xl
                hover:shadow-slate-200/50
              "
            >

              <div
                className="
                  mb-8
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-orange-50
                  text-orange-500
                  transition-all
                  duration-300
                  group-hover:bg-orange-500
                  group-hover:text-white
                "
              >
                <Building2
                  size={28}
                  strokeWidth={1.8}
                />
              </div>


              <h3
                className="
                  text-xl
                  font-bold
                  text-slate-950
                "
              >
                Property Management
              </h3>


              <p
                className="
                  mt-3
                  max-w-[400px]
                  text-sm
                  leading-6
                  text-slate-600
                "
              >
                Manage your properties, keep
                information organized and stay
                connected with your home services.
              </p>


              <div
                className="
                  mt-7
                  flex
                  items-center
                  gap-2
                  text-sm
                  font-bold
                  text-orange-500
                  opacity-0
                  transition-all
                  duration-300
                  group-hover:translate-x-1
                  group-hover:opacity-100
                "
              >
                Manage Property

                <ArrowRight
                  size={16}
                />
              </div>

            </Link>


            {/* ===================================================
                05 — TRUSTED PROFESSIONALS
            =================================================== */}

            <Link
              href="/professionals"
              className="
                group
                block
                rounded-[28px]
                border
                border-slate-200
                bg-white
                p-10
                transition-all
                duration-300
                hover:-translate-y-1
                hover:border-orange-200
                hover:shadow-xl
                hover:shadow-slate-200/50
              "
            >

              <div
                className="
                  mb-8
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-orange-50
                  text-orange-500
                  transition-all
                  duration-300
                  group-hover:bg-orange-500
                  group-hover:text-white
                "
              >
                <ShieldCheck
                  size={28}
                  strokeWidth={1.8}
                />
              </div>


              <h3
                className="
                  text-xl
                  font-bold
                  text-slate-950
                "
              >
                Trusted Professionals
              </h3>


              <p
                className="
                  mt-3
                  max-w-[400px]
                  text-sm
                  leading-6
                  text-slate-600
                "
              >
                Connect with service professionals
                and discover the right expertise
                for your home.
              </p>


              <div
                className="
                  mt-7
                  flex
                  items-center
                  gap-2
                  text-sm
                  font-bold
                  text-orange-500
                  opacity-0
                  transition-all
                  duration-300
                  group-hover:translate-x-1
                  group-hover:opacity-100
                "
              >
                View Professionals

                <ArrowRight
                  size={16}
                />
              </div>

            </Link>


            {/* ===================================================
                06 — HOME COMMUNITY
            =================================================== */}

            <Link
              href="/community"
              className="
                group
                block
                rounded-[28px]
                border
                border-slate-200
                bg-white
                p-10
                transition-all
                duration-300
                hover:-translate-y-1
                hover:border-orange-200
                hover:shadow-xl
                hover:shadow-slate-200/50
              "
            >

              <div
                className="
                  mb-8
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-orange-50
                  text-orange-500
                  transition-all
                  duration-300
                  group-hover:bg-orange-500
                  group-hover:text-white
                "
              >
                <Users
                  size={28}
                  strokeWidth={1.8}
                />
              </div>


              <h3
                className="
                  text-xl
                  font-bold
                  text-slate-950
                "
              >
                Home Community
              </h3>


              <p
                className="
                  mt-3
                  max-w-[400px]
                  text-sm
                  leading-6
                  text-slate-600
                "
              >
                Connect with your community,
                share experiences and discover
                useful home-related information.
              </p>


              <div
                className="
                  mt-7
                  flex
                  items-center
                  gap-2
                  text-sm
                  font-bold
                  text-orange-500
                  opacity-0
                  transition-all
                  duration-300
                  group-hover:translate-x-1
                  group-hover:opacity-100
                "
              >
                Join Community

                <ArrowRight
                  size={16}
                />
              </div>

            </Link>

          </div>

        </div>

      </section>


      {/* =========================================================
          HOW IT WORKS
      ========================================================= */}

      <section
        id="how-it-works"
        className="
          border-y
          border-slate-200
          bg-white
        "
      >

        <div
          className="
            mx-auto
            max-w-[1700px]
            px-6
            py-20
            lg:px-10
          "
        >

          <div
            className="
              max-w-2xl
            "
          >

            <p
              className="
                text-xs
                font-bold
                uppercase
                tracking-[0.2em]
                text-orange-500
              "
            >
              How It Works
            </p>

            <h2
              className="
                mt-2
                text-3xl
                font-black
                tracking-tight
                text-slate-950
                md:text-4xl
              "
            >
              Getting things done is simple
            </h2>

          </div>


          <div
            className="
              mt-12
              grid
              grid-cols-1
              gap-8
              md:grid-cols-3
            "
          >

            {/* STEP 1 */}

            <div>

              <div
                className="
                  mb-6
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-xl
                  bg-slate-950
                  text-sm
                  font-black
                  text-white
                "
              >
                01
              </div>

              <h3
                className="
                  text-lg
                  font-bold
                "
              >
                Create your account
              </h3>

              <p
                className="
                  mt-2
                  text-sm
                  leading-6
                  text-slate-500
                "
              >
                Register as a customer,
                professional or business and
                create your HomeMate profile.
              </p>

            </div>


            {/* STEP 2 */}

            <div>

              <div
                className="
                  mb-6
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-xl
                  bg-slate-950
                  text-sm
                  font-black
                  text-white
                "
              >
                02
              </div>

              <h3
                className="
                  text-lg
                  font-bold
                "
              >
                Find what you need
              </h3>

              <p
                className="
                  mt-2
                  text-sm
                  leading-6
                  text-slate-500
                "
              >
                Discover home services and
                professionals that match your
                requirements.
              </p>

            </div>


            {/* STEP 3 */}

            <div>

              <div
                className="
                  mb-6
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-xl
                  bg-slate-950
                  text-sm
                  font-black
                  text-white
                "
              >
                03
              </div>

              <h3
                className="
                  text-lg
                  font-bold
                "
              >
                Book and manage
              </h3>

              <p
                className="
                  mt-2
                  text-sm
                  leading-6
                  text-slate-500
                "
              >
                Book services, manage your
                property and keep track of your
                home-service activity.
              </p>

            </div>

          </div>

        </div>

      </section>


      {/* =========================================================
          WHY HOMEmate
      ========================================================= */}

      <section
        id="why-homemate"
        className="
          bg-slate-50
        "
      >

        <div
          className="
            mx-auto
            max-w-[1700px]
            px-6
            py-20
            lg:px-10
          "
        >

          <div
            className="
              grid
              grid-cols-1
              gap-14
              lg:grid-cols-2
              lg:items-center
            "
          >

            <div>

              <p
                className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.2em]
                  text-orange-500
                "
              >
                Why HomeMate
              </p>

              <h2
                className="
                  mt-3
                  text-3xl
                  font-black
                  tracking-tight
                  text-slate-950
                  md:text-4xl
                "
              >
                One platform for your
                everyday home needs
              </h2>

              <p
                className="
                  mt-5
                  max-w-xl
                  text-sm
                  leading-7
                  text-slate-600
                "
              >
                HomeMate brings homeowners,
                professionals and businesses
                together so that home services
                are easier to discover, book and
                manage.
              </p>

            </div>


            <div
              className="
                grid
                grid-cols-1
                gap-4
                sm:grid-cols-2
              "
            >

              <div
                className="
                  border
                  border-slate-200
                  bg-white
                  p-6
                "
              >

                <CheckCircle2
                  size={22}
                  className="text-orange-500"
                />

                <h3
                  className="
                    mt-5
                    font-bold
                  "
                >
                  Trusted Connections
                </h3>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-5
                    text-slate-500
                  "
                >
                  Discover professionals for
                  different home-service needs.
                </p>

              </div>


              <div
                className="
                  border
                  border-slate-200
                  bg-white
                  p-6
                "
              >

                <MapPin
                  size={22}
                  className="text-orange-500"
                />

                <h3
                  className="
                    mt-5
                    font-bold
                  "
                >
                  Nearby Services
                </h3>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-5
                    text-slate-500
                  "
                >
                  Find professionals and
                  services around your property.
                </p>

              </div>


              <div
                className="
                  border
                  border-slate-200
                  bg-white
                  p-6
                "
              >

                <Clock3
                  size={22}
                  className="text-orange-500"
                />

                <h3
                  className="
                    mt-5
                    font-bold
                  "
                >
                  Convenient Booking
                </h3>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-5
                    text-slate-500
                  "
                >
                  Manage your service bookings
                  from one place.
                </p>

              </div>


              <div
                className="
                  border
                  border-slate-200
                  bg-white
                  p-6
                "
              >

                <ShieldCheck
                  size={22}
                  className="text-orange-500"
                />

                <h3
                  className="
                    mt-5
                    font-bold
                  "
                >
                  Secure Platform
                </h3>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-5
                    text-slate-500
                  "
                >
                  Your account and service
                  activity stay protected.
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =========================================================
          COMMUNITY CTA
      ========================================================= */}

      <section
        id="community"
        className="
          bg-slate-950
        "
      >

        <div
          className="
            mx-auto
            max-w-[1700px]
            px-6
            py-20
            lg:px-10
          "
        >

          <div
            className="
              flex
              flex-col
              gap-8
              md:flex-row
              md:items-center
              md:justify-between
            "
          >

            <div
              className="
                max-w-2xl
              "
            >

              <p
                className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.2em]
                  text-orange-400
                "
              >
                HomeMate Community
              </p>

              <h2
                className="
                  mt-3
                  text-3xl
                  font-black
                  tracking-tight
                  text-white
                  md:text-4xl
                "
              >
                Make your home easier
                to manage.
              </h2>

              <p
                className="
                  mt-4
                  text-sm
                  leading-7
                  text-slate-400
                "
              >
                Create your HomeMate account
                and start exploring services,
                professionals and home-management
                features.
              </p>

            </div>


            <Link
              href="/register"
              className="
                inline-flex
                shrink-0
                items-center
                justify-center
                gap-3
                rounded-xl
                bg-orange-500
                px-7
                py-4
                text-sm
                font-bold
                text-white
                transition
                hover:bg-orange-600
              "
            >
              Create Account

              <ArrowRight
                size={17}
              />
            </Link>

          </div>

        </div>

      </section>


      {/* =========================================================
          FOOTER
      ========================================================= */}

      <footer
        className="
          border-t
          border-slate-800
          bg-slate-950
        "
      >

        <div
          className="
            mx-auto
            flex
            max-w-[1700px]
            flex-col
            gap-5
            px-6
            py-7
            md:flex-row
            md:items-center
            md:justify-between
            lg:px-10
          "
        >

          <div>

            <div
              className="
                text-lg
                font-black
                text-white
              "
            >
              Home<span className="text-orange-500">
                Mate
              </span>
            </div>

            <p
              className="
                mt-1
                text-[10px]
                uppercase
                tracking-wider
                text-slate-500
              "
            >
              Home Services Platform
            </p>

          </div>


          <p
            className="
              text-xs
              text-slate-500
            "
          >
            © {new Date().getFullYear()} HomeMate.
            All rights reserved.
          </p>

        </div>

      </footer>

    </main>
  );
}