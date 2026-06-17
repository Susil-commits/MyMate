import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  HiShieldCheck,
  HiStar,
  HiLocationMarker,
  HiClock,
  HiCurrencyDollar,
  HiUserGroup,
  HiBadgeCheck,
  HiArrowRight,
  HiChevronDown,
} from "react-icons/hi";
import { FaCar, FaUserTie, FaHandshake, FaRoad, FaQuoteLeft } from "react-icons/fa";
import { useScrollReveal, useCountUp } from "../hooks/useAnimations";
import api from "../api/axios";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [statsData, setStatsData] = useState({ driverCount: 0, tripCount: 0, cityCount: 0 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get("/drivers?limit=1");
        const driverCount = data.pagination?.total || 0;
        setStatsData((prev) => ({ ...prev, driverCount: driverCount || prev.driverCount }));
      } catch {
        // use defaults
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-x-hidden transition-colors duration-300">
      <Header scrolled={scrolled} />
      <HeroSection stats={statsData} />
      <FeaturesSection />
      <StatsSection stats={statsData} />
      <HowItWorksSection />
      <TestimonialsSection />
      <AboutSection />
      <CTASection />
      <Footer />
    </div>
  );
}

function Header({ scrolled }) {
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-gray-700"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <FaCar className="text-white text-sm" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight dark:text-white">
            <span className="text-blue-600">My</span>Mate
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a>
          <a href="#stats" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Stats</a>
          <a href="#how-it-works" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">How It Works</a>
          <a href="#testimonials" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Testimonials</a>
          <a href="#about" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/user/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Sign In
          </Link>
          <Link
            to="/user/register"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/25 transition-all duration-300"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroSection({ stats }) {
  const driverCount = useCountUp(stats.driverCount, 2000, true);
  const tripCount = useCountUp(stats.tripCount, 2000, true);
  const cityCount = useCountUp(stats.cityCount, 2000, true);

  return (
    <section className="relative min-h-screen flex items-center hero-gradient overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-500/5 dark:bg-blue-500/3 blur-3xl animate-float" style={{ animationDelay: "0s" }} />
        <div className="absolute top-1/3 -left-20 w-60 h-60 rounded-full bg-purple-500/5 dark:bg-purple-500/3 blur-3xl animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute -bottom-20 right-1/4 w-72 h-72 rounded-full bg-indigo-500/5 dark:bg-indigo-500/3 blur-3xl animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/4 left-1/3 w-4 h-4 bg-blue-400/30 dark:bg-blue-400/20 rounded-full animate-pulse-soft" />
        <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-purple-400/30 dark:bg-purple-400/20 rounded-full animate-pulse-soft" style={{ animationDelay: "0.5s" }} />
        <div className="absolute bottom-1/4 left-1/5 w-5 h-5 bg-indigo-400/20 dark:bg-indigo-400/10 rounded-full animate-pulse-soft" style={{ animationDelay: "1s" }} />
        <div className="absolute top-20 right-1/3 w-2 h-2 bg-blue-300/40 dark:bg-blue-300/20 rounded-full animate-pulse-soft" style={{ animationDelay: "1.5s" }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="max-w-3xl">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded-full border border-blue-100 dark:border-blue-800 mb-6">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse-soft" />
              Now available in your locality
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 dark:text-white leading-[1.05] tracking-tight animate-fade-up">
            Hire Trusted
            <br />
            <span className="gradient-text">Drivers Near You</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed animate-fade-up animate-delay-200">
            Connect with experienced, verified local drivers. Whether for a day or the long haul —
            find your perfect match based on ratings, experience, and proximity.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-up animate-delay-300">
            <Link
              to="/user/register"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl text-lg font-semibold hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/20 transition-all duration-300 hover:-translate-y-0.5"
            >
              Find a Driver
              <HiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/driver/register"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl text-lg font-semibold border-2 border-gray-200 dark:border-gray-600 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
            >
              Become a Driver
              <FaUserTie className="group-hover:scale-110 transition-transform" />
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-3 gap-8 max-w-md animate-fade-up animate-delay-400">
            <div>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{driverCount.toLocaleString()}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Drivers</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{tripCount.toLocaleString()}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Trips</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{cityCount.toLocaleString()}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Cities</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-gentle">
        <HiChevronDown className="w-6 h-6 text-gray-400 dark:text-gray-600" />
      </div>
    </section>
  );
}

function FeaturesSection() {
  const [ref, visible] = useScrollReveal();

  const features = [
    {
      icon: <HiLocationMarker className="w-7 h-7" />,
      title: "Local Drivers",
      desc: "Browse verified drivers in your city or area with precise locality-based search.",
      bg: "bg-blue-50 dark:bg-blue-900/30",
      text: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: <HiStar className="w-7 h-7" />,
      title: "Verified Ratings",
      desc: "Real reviews and ratings from customers who have actually hired the driver.",
      bg: "bg-yellow-50 dark:bg-yellow-900/30",
      text: "text-yellow-600 dark:text-yellow-400",
    },
    {
      icon: <HiShieldCheck className="w-7 h-7" />,
      title: "Document Verified",
      desc: "Every driver submits license documents. Verified by our team before activation.",
      bg: "bg-green-50 dark:bg-green-900/30",
      text: "text-green-600 dark:text-green-400",
    },
    {
      icon: <HiClock className="w-7 h-7" />,
      title: "Flexible Hiring",
      desc: "Temporary drivers for a few hours or permanent drivers for long-term needs.",
      bg: "bg-purple-50 dark:bg-purple-900/30",
      text: "text-purple-600 dark:text-purple-400",
    },
    {
      icon: <HiCurrencyDollar className="w-7 h-7" />,
      title: "Transparent Pricing",
      desc: "Hourly and daily rates displayed upfront. No hidden charges or surprises.",
      bg: "bg-orange-50 dark:bg-orange-900/30",
      text: "text-orange-600 dark:text-orange-400",
    },
    {
      icon: <FaHandshake className="w-7 h-7" />,
      title: "Secure Payments",
      desc: "Payments processed securely through Stripe with full buyer protection.",
      bg: "bg-indigo-50 dark:bg-indigo-900/30",
      text: "text-indigo-600 dark:text-indigo-400",
    },
  ];

  return (
    <section id="features" ref={ref} className="py-24 bg-gray-50/50 dark:bg-gray-800/50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Features</span>
          <h2 className="mt-3 text-4xl font-extrabold text-gray-900 dark:text-white">Everything you need</h2>
          <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
            From discovering trusted drivers to seamless booking and secure payments — we have got you covered.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`card-hover bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 group transition-all duration-700 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className={`w-14 h-14 rounded-2xl ${f.bg} ${f.text} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsSection({ stats }) {
  const [ref, visible] = useScrollReveal();
  const driverCount = useCountUp(stats.driverCount, 2000, visible);
  const tripCount = useCountUp(stats.tripCount, 2000, visible);
  const cityCount = useCountUp(stats.cityCount, 2000, visible);

  return (
    <section id="stats" ref={ref} className="py-20 bg-gradient-to-br from-blue-600 to-purple-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="text-4xl sm:text-5xl font-extrabold text-white">{driverCount.toLocaleString()}+</div>
            <div className="mt-2 text-blue-200 font-medium">Verified Drivers</div>
          </div>
          <div className={`transition-all duration-700 delay-100 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="text-4xl sm:text-5xl font-extrabold text-white">{tripCount.toLocaleString()}+</div>
            <div className="mt-2 text-blue-200 font-medium">Completed Trips</div>
          </div>
          <div className={`transition-all duration-700 delay-200 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="text-4xl sm:text-5xl font-extrabold text-white">{cityCount.toLocaleString()}+</div>
            <div className="mt-2 text-blue-200 font-medium">Cities Covered</div>
          </div>
          <div className={`transition-all duration-700 delay-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="text-4xl sm:text-5xl font-extrabold text-white">{stats.driverCount > 0 ? "4.8" : "—"}</div>
            <div className="mt-2 text-blue-200 font-medium flex items-center justify-center gap-1">
              <HiStar className="w-4 h-4" /> Average Rating
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const [ref, visible] = useScrollReveal();

  const steps = [
    {
      step: "01",
      icon: <HiUserGroup className="w-8 h-8" />,
      title: "Create Account",
      desc: "Sign up as a user looking for drivers or register as a driver to start earning.",
      color: "from-blue-500 to-indigo-500",
    },
    {
      step: "02",
      icon: <HiLocationMarker className="w-8 h-8" />,
      title: "Search & Filter",
      desc: "Browse drivers by locality, experience level, vehicle type, ratings, and more.",
      color: "from-purple-500 to-pink-500",
    },
    {
      step: "03",
      icon: <FaHandshake className="w-8 h-8" />,
      title: "Book & Pay",
      desc: "Send a booking request. Once accepted, pay securely through Stripe. That's it!",
      color: "from-green-500 to-teal-500",
    },
    {
      step: "04",
      icon: <FaRoad className="w-8 h-8" />,
      title: "Hit the Road",
      desc: "Your driver arrives, the trip begins. Rate your experience once completed.",
      color: "from-orange-500 to-red-500",
    },
  ];

  return (
    <section id="how-it-works" ref={ref} className="py-24 bg-white dark:bg-gray-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Process</span>
          <h2 className="mt-3 text-4xl font-extrabold text-gray-900 dark:text-white">How It Works</h2>
          <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Four simple steps to get on the road with a trusted driver.</p>
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-green-200 dark:from-blue-800 dark:via-purple-800 dark:to-green-800 -translate-y-1/2" />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div
                key={s.step}
                className={`relative text-center transition-all duration-700 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className={`w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-lg mb-6 relative z-10`}>
                  {s.icon}
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center z-20">
                  {i + 1}
                </div>
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full absolute -bottom-3 left-1/2 -translate-x-1/2 -z-10 group-hover:scale-150 transition-transform duration-500" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-4">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const [ref, visible] = useScrollReveal();

  return (
    <section id="testimonials" ref={ref} className="py-24 bg-gray-50/50 dark:bg-gray-800/50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Testimonials</span>
          <h2 className="mt-3 text-4xl font-extrabold text-gray-900 dark:text-white">What people say</h2>
          <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Reviews from verified customers and drivers on our platform.</p>
        </div>
        <div className={`text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 transition-all duration-700 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          <FaQuoteLeft className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Reviews will appear here as customers complete bookings.</p>
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  const [ref, visible] = useScrollReveal();

  return (
    <section id="about" ref={ref} className="py-24 bg-gray-900 dark:bg-gray-950 text-white overflow-hidden transition-colors duration-300">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className={`transition-all duration-700 ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"}`}>
            <span className="text-sm font-semibold text-blue-400 uppercase tracking-wider">About MyMate</span>
            <h2 className="mt-3 text-4xl font-extrabold text-white">
              Connecting people with
              <span className="text-blue-400"> trusted drivers</span>
            </h2>
            <p className="mt-6 text-lg text-gray-400 leading-relaxed">
              MyMate was born from a simple idea: finding a reliable driver shouldn't be a gamble.
              We built a platform where drivers are verified, reviews are genuine, and locality-based
              matching connects you with the right person — every time.
            </p>
            <div className="mt-8 space-y-5">
              <AboutPoint icon={<HiBadgeCheck className="w-5 h-5 text-green-400" />} text="All drivers go through document verification" />
              <AboutPoint icon={<HiStar className="w-5 h-5 text-yellow-400" />} text="Genuine reviews from completed bookings only" />
              <AboutPoint icon={<HiLocationMarker className="w-5 h-5 text-blue-400" />} text="Locality-based search for the best match" />
              <AboutPoint icon={<HiShieldCheck className="w-5 h-5 text-purple-400" />} text="Secure payments with Stripe protection" />
            </div>
          </div>

          <div className={`transition-all duration-700 delay-300 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12"}`}>
            <div className="relative">
              <div className="w-full h-80 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-3xl border border-gray-700 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mb-6">
                    <FaCar className="text-white text-3xl" />
                  </div>
                  <div className="text-5xl font-extrabold text-white mb-2">MyMate</div>
                  <p className="text-gray-400">Drive with confidence.</p>
                </div>
              </div>
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-500/20 rounded-2xl blur-xl animate-float" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-purple-500/20 rounded-2xl blur-xl animate-float" style={{ animationDelay: "1.5s" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutPoint({ icon, text }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <p className="text-gray-300">{text}</p>
    </div>
  );
}

function CTASection() {
  const [ref, visible] = useScrollReveal();

  return (
    <section ref={ref} className="py-24 bg-white dark:bg-gray-900 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className={`transition-all duration-700 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-20 animate-pulse-soft" />
            <div className="relative bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl p-12 sm:p-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
                Ready to find your{' '}
                <span className="gradient-text">perfect driver</span>?
              </h2>
              <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
                Join MyMate and connect with trusted drivers in your locality today.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/user/register"
                  className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-lg font-semibold hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/20 transition-all duration-300 hover:-translate-y-0.5"
                >
                  Get Started Free
                </Link>
                <Link
                  to="/driver/register"
                  className="px-8 py-4 border-2 border-green-500 text-green-600 dark:text-green-400 rounded-2xl text-lg font-semibold hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-300 hover:-translate-y-0.5"
                >
                  Register as Driver
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 dark:bg-gray-950 text-gray-400 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <FaCar className="text-white text-sm" />
              </div>
              <span className="text-2xl font-extrabold text-white">MyMate</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm">
              Your trusted platform for hiring verified local drivers. Safe, reliable, and built for
              your convenience.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">For Users</h4>
            <div className="space-y-2 text-sm">
              <p><Link to="/user/register" className="hover:text-white transition-colors">Create Account</Link></p>
              <p><Link to="/user/login" className="hover:text-white transition-colors">Sign In</Link></p>
              <p><Link to="/drivers" className="hover:text-white transition-colors">Browse Drivers</Link></p>
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">For Drivers</h4>
            <div className="space-y-2 text-sm">
              <p><Link to="/driver/register" className="hover:text-white transition-colors">Register</Link></p>
              <p><Link to="/driver/login" className="hover:text-white transition-colors">Sign In</Link></p>
              <p><Link to="/driver/dashboard" className="hover:text-white transition-colors">Dashboard</Link></p>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm">
          &copy; {new Date().getFullYear()} MyMate. All rights reserved.
        </div>
      </div>
    </footer>
  );
}