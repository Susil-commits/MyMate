import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  HiShieldCheck, HiStar, HiLocationMarker, HiClock, HiCurrencyDollar,
  HiUserGroup, HiBadgeCheck, HiArrowRight, HiChevronDown,
  HiLightningBolt, HiHeart, HiSearch,
} from "react-icons/hi";
import { FaCar, FaUserTie, FaHandshake, FaRoad, FaQuoteLeft, FaPhoneAlt, FaEnvelope } from "react-icons/fa";
import { useScrollReveal, useCountUp } from "../hooks/useAnimations";
import api from "../api/axios";

const particleColors = ["#2563eb", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#06b6d4", "#0ea5e9", "#f59e0b", "#ec4899", "#14b8a6"];

const floatingParticles = Array.from({ length: 20 }, () => ({
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: `${Math.random() * 6 + 3}px`,
  delay: `${Math.random() * 8}s`,
  duration: `${Math.random() * 6 + 5}s`,
}));

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [statsData, setStatsData] = useState({ driverCount: 0, tripCount: 0, cityCount: 0 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    api.get("/drivers?limit=1").then(({ data }) => {
      setStatsData((prev) => ({ ...prev, driverCount: data.pagination?.total || 0 }));
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
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
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-xl shadow-sm border-b border-gray-100" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-blue-600/20">
            <FaCar className="text-white text-sm" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-gray-900">
            <span className="gradient-text">My</span>Mate
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {["Features", "Stats", "Process", "Testimonials", "About"].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(" ", "-")}`} className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors relative group">
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 group-hover:w-full transition-all duration-300 rounded-full" />
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/user/login" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-3 py-2">Sign In</Link>
          <Link to="/user/register" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:shadow-xl hover:shadow-blue-600/25 hover:-translate-y-0.5 transition-all duration-300">Get Started</Link>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-gray-100 animate-slide-down">
          <div className="px-4 py-4 space-y-3">
            {["Features", "Stats", "Process", "Testimonials"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-600 hover:text-blue-600 py-2">{item}</a>
            ))}
            <div className="pt-3 border-t border-gray-100 flex gap-3">
              <Link to="/user/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center text-sm font-medium text-gray-700 py-2.5 rounded-xl border border-gray-200">Sign In</Link>
              <Link to="/user/register" onClick={() => setMobileOpen(false)} className="flex-1 text-center text-sm font-semibold text-white py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">Get Started</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function HeroSection({ stats }) {
  const driverCount = useCountUp(stats.driverCount, 2000, true);
  const tripCount = useCountUp(stats.tripCount, 2000, true);
  const cityCount = useCountUp(stats.cityCount, 2000, true);

  return (
    <section className="relative min-h-screen flex items-center bg-white overflow-hidden">
      <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "radial-gradient(circle, #2563eb 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {floatingParticles.map((p, i) => (
          <div key={i} className="hero-particle" style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: p.delay, animationDuration: p.duration, background: particleColors[i % particleColors.length], opacity: 0.45 }} />
        ))}
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-500/[0.03] blur-3xl animate-drift" />
        <div className="absolute top-1/3 -left-20 w-[500px] h-[500px] rounded-full bg-purple-500/[0.03] blur-3xl animate-drift" style={{ animationDelay: "4s" }} />
        <div className="absolute -bottom-20 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/[0.03] blur-3xl animate-drift" style={{ animationDelay: "2s" }} />
        <div className="hero-ring" style={{ width: "200px", height: "200px", top: "20%", left: "10%" }} />
        <div className="hero-ring" style={{ width: "150px", height: "150px", top: "60%", right: "15%", animationDelay: "2s" }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="max-w-3xl">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100 mb-6">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              Now available in your locality
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-[1.05] tracking-tight animate-fade-up">
            Hire Trusted<br />
            <span className="gradient-text">Drivers Near You</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-500 max-w-xl leading-relaxed animate-fade-up animate-delay-200">
            Connect with experienced, verified local drivers. Whether for a day or the long haul — find your perfect match based on ratings, experience, and proximity.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-up animate-delay-300">
            <Link to="/user/register" className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-lg font-semibold hover:shadow-2xl hover:shadow-blue-600/25 transition-all duration-300 hover:-translate-y-0.5">
              Find a Driver
              <HiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/driver/register" className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 rounded-2xl text-lg font-semibold border-2 border-gray-200 hover:border-green-400 hover:text-green-600 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
              Become a Driver
              <FaUserTie className="group-hover:scale-110 transition-transform" />
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-3 gap-8 max-w-md animate-fade-up animate-delay-400">
            <div><div className="text-2xl font-extrabold text-gray-900">{driverCount.toLocaleString()}</div><div className="text-sm text-gray-500">Drivers</div></div>
            <div><div className="text-2xl font-extrabold text-gray-900">{tripCount.toLocaleString()}</div><div className="text-sm text-gray-500">Trips</div></div>
            <div><div className="text-2xl font-extrabold text-gray-900">{cityCount.toLocaleString()}</div><div className="text-sm text-gray-500">Cities</div></div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-gentle">
        <HiChevronDown className="w-6 h-6 text-gray-400" />
      </div>
    </section>
  );
}

function FeaturesSection() {
  const [ref, visible] = useScrollReveal();
  const features = [
    { icon: <HiLocationMarker className="w-7 h-7" />, title: "Local Drivers", desc: "Browse verified drivers in your city or area with precise locality-based search.", gradient: "from-blue-500 to-blue-600" },
    { icon: <HiStar className="w-7 h-7" />, title: "Verified Ratings", desc: "Real reviews and ratings from customers who have actually hired the driver.", gradient: "from-amber-500 to-orange-500" },
    { icon: <HiShieldCheck className="w-7 h-7" />, title: "Document Verified", desc: "Every driver submits license documents. Verified by our team before activation.", gradient: "from-green-500 to-emerald-600" },
    { icon: <HiClock className="w-7 h-7" />, title: "Flexible Hiring", desc: "Temporary drivers for a few hours or permanent drivers for long-term needs.", gradient: "from-purple-500 to-violet-600" },
    { icon: <HiCurrencyDollar className="w-7 h-7" />, title: "Transparent Pricing", desc: "Hourly and daily rates displayed upfront. No hidden charges or surprises.", gradient: "from-rose-500 to-pink-600" },
    { icon: <FaHandshake className="w-7 h-7" />, title: "Secure Payments", desc: "Payments processed securely through Stripe with full buyer protection.", gradient: "from-indigo-500 to-blue-600" },
  ];

  return (
    <section id="features" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full uppercase tracking-wider"><HiLightningBolt className="w-3.5 h-3.5" /> Features</span>
          <h2 className="mt-4 text-4xl font-extrabold text-gray-900">Everything you need</h2>
          <p className="mt-4 text-lg text-gray-500">From discovering trusted drivers to seamless booking and secure payments — we have got you covered.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={f.title} className={`card-glow bg-white rounded-2xl p-8 border border-gray-100 shadow-sm group transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 text-white shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>{f.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 leading-relaxed">{f.desc}</p>
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
    <section id="stats" ref={ref} className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />
      <div className="absolute inset-0 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.04]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 text-center">
          {[
            { value: `${driverCount.toLocaleString()}+`, label: "Verified Drivers", icon: FaUserTie, delay: 0 },
            { value: `${tripCount.toLocaleString()}+`, label: "Completed Trips", icon: FaRoad, delay: 100 },
            { value: `${cityCount.toLocaleString()}+`, label: "Cities Covered", icon: HiLocationMarker, delay: 200 },
            { value: stats.driverCount > 0 ? "4.8" : "—", label: "Average Rating", icon: HiStar, delay: 300 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${item.delay}ms` }}>
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center"><Icon className="w-6 h-6 text-white/80" /></div>
                <div className="text-4xl sm:text-5xl font-extrabold text-white">{item.value}</div>
                <div className="mt-2 text-blue-100 font-medium text-sm">{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const [ref, visible] = useScrollReveal();
  const steps = [
    { icon: <HiUserGroup className="w-8 h-8" />, title: "Create Account", desc: "Sign up as a user looking for drivers or register as a driver to start earning.", gradient: "from-blue-500 to-indigo-500", shadow: "shadow-blue-500/25" },
    { icon: <HiSearch className="w-8 h-8" />, title: "Search & Filter", desc: "Browse drivers by locality, experience level, vehicle type, ratings, and more.", gradient: "from-purple-500 to-pink-500", shadow: "shadow-purple-500/25" },
    { icon: <FaHandshake className="w-8 h-8" />, title: "Book & Pay", desc: "Send a booking request. Once accepted, pay securely through Stripe. That's it!", gradient: "from-green-500 to-teal-500", shadow: "shadow-green-500/25" },
    { icon: <FaRoad className="w-8 h-8" />, title: "Hit the Road", desc: "Your driver arrives, the trip begins. Rate your experience once completed.", gradient: "from-orange-500 to-red-500", shadow: "shadow-orange-500/25" },
  ];

  return (
    <section id="how-it-works" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full uppercase tracking-wider"><HiLightningBolt className="w-3.5 h-3.5" /> Process</span>
          <h2 className="mt-4 text-4xl font-extrabold text-gray-900">How It Works</h2>
          <p className="mt-4 text-lg text-gray-500">Four simple steps to get on the road with a trusted driver.</p>
        </div>
        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-green-200 -translate-y-1/2 rounded-full" />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.title} className={`relative text-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`} style={{ transitionDelay: `${i * 150}ms` }}>
                <div className={`w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-white shadow-xl ${s.shadow} mb-6 relative z-10 group-hover:scale-110 transition-transform duration-300`}>{s.icon}</div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center z-20 ring-4 ring-white">{i + 1}</div>
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full absolute -bottom-3 left-1/2 -translate-x-1/2 -z-10" />
                <h3 className="text-xl font-bold text-gray-900 mt-4">{s.title}</h3>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">{s.desc}</p>
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
  const testimonials = [
    { name: "Rahul Sharma", role: "Regular Customer", text: "Found a reliable driver for my daily commute in under 10 minutes. The locality-based search is a game changer!", gradient: "from-blue-500 to-indigo-500", initials: "RS" },
    { name: "Priya Patel", role: "Business Owner", text: "Needed a driver for outstation trips. MyMate connected me with verified professionals. Highly recommended!", gradient: "from-purple-500 to-pink-500", initials: "PP" },
    { name: "Amit Kumar", role: "Driver Partner", text: "As a driver, MyMate has been incredible. Steady bookings, fair pay, and a great rating system.", gradient: "from-green-500 to-teal-500", initials: "AK" },
  ];

  return (
    <section id="testimonials" ref={ref} className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full uppercase tracking-wider"><HiHeart className="w-3.5 h-3.5" /> Testimonials</span>
          <h2 className="mt-4 text-4xl font-extrabold text-gray-900">What people say</h2>
          <p className="mt-4 text-lg text-gray-500">Reviews from verified customers and drivers on our platform.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={t.name} className={`card-glow bg-white rounded-2xl p-8 border border-gray-100 shadow-sm transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 150}ms` }}>
              <FaQuoteLeft className="w-8 h-8 text-blue-200" />
              <p className="mt-4 text-gray-600 leading-relaxed">{t.text}</p>
              <div className="flex items-center gap-1 mt-4">
                {[...Array(5)].map((_, j) => <HiStar key={j} className="w-5 h-5 text-yellow-500" />)}
              </div>
              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-50">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white text-sm font-bold`}>{t.initials}</div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  const [ref, visible] = useScrollReveal();
  return (
    <section id="about" ref={ref} className="py-24 bg-gray-900 text-white overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl animate-drift" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl animate-drift" style={{ animationDelay: "4s" }} />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className={`transition-all duration-700 ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"}`}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-semibold rounded-full uppercase tracking-wider"><HiBadgeCheck className="w-3.5 h-3.5" /> About MyMate</span>
            <h2 className="mt-4 text-4xl font-extrabold text-white">Connecting people with<br /><span className="gradient-text">trusted drivers</span></h2>
            <p className="mt-6 text-lg text-gray-400 leading-relaxed">MyMate was born from a simple idea: finding a reliable driver shouldn't be a gamble. We built a platform where drivers are verified, reviews are genuine, and locality-based matching connects you with the right person — every time.</p>
            <div className="mt-8 space-y-5">
              {[
                { icon: <HiBadgeCheck className="w-5 h-5 text-green-400" />, text: "All drivers go through document verification" },
                { icon: <HiStar className="w-5 h-5 text-yellow-400" />, text: "Genuine reviews from completed bookings only" },
                { icon: <HiLocationMarker className="w-5 h-5 text-blue-400" />, text: "Locality-based search for the best match" },
                { icon: <HiShieldCheck className="w-5 h-5 text-purple-400" />, text: "Secure payments with Stripe protection" },
              ].map((p) => (
                <div key={p.text} className="flex items-start gap-3 group">
                  <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">{p.icon}</div>
                  <p className="text-gray-300">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className={`transition-all duration-700 delay-300 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12"}`}>
            <div className="relative">
              <div className="w-full aspect-square max-w-sm mx-auto bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-3xl border border-gray-700/50 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/20 animate-float">
                    <FaCar className="text-white text-4xl" />
                  </div>
                  <div className="text-6xl font-extrabold text-white mb-2"><span className="gradient-text">My</span>Mate</div>
                  <p className="text-gray-400 text-lg">Drive with confidence.</p>
                  <div className="mt-6 flex items-center justify-center gap-4">
                    <div className="flex -space-x-2">
                      {["from-blue-500", "from-purple-500", "from-green-500", "from-orange-500"].map((g, i) => (
                        <div key={i} className={`w-8 h-8 rounded-full bg-gradient-to-br ${g} to-${g.split("-")[1]}-600 ring-2 ring-gray-900 flex items-center justify-center text-white text-xs font-bold`} />
                      ))}
                    </div>
                    <span className="text-sm text-gray-400">Trusted by many</span>
                  </div>
                </div>
              </div>
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-500/10 rounded-2xl blur-xl animate-float" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-purple-500/10 rounded-2xl blur-xl animate-float" style={{ animationDelay: "1.5s" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const [ref, visible] = useScrollReveal();
  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className={`transition-all duration-700 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 rounded-3xl blur-3xl opacity-20 animate-pulse-soft" />
            <div className="relative bg-white rounded-3xl border border-gray-100 shadow-2xl p-12 sm:p-16">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-600/20">
                <FaCar className="text-white text-2xl" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Ready to find your <span className="gradient-text">perfect driver</span>?</h2>
              <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">Join MyMate and connect with trusted drivers in your locality today.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/user/register" className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-lg font-semibold hover:shadow-2xl hover:shadow-blue-600/25 transition-all duration-300 hover:-translate-y-0.5">Get Started Free</Link>
                <Link to="/driver/register" className="px-8 py-4 border-2 border-green-500 text-green-600 rounded-2xl text-lg font-semibold hover:bg-green-50 transition-all duration-300 hover:-translate-y-0.5">Register as Driver</Link>
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
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20"><FaCar className="text-white text-sm" /></div>
              <span className="text-2xl font-extrabold text-white"><span className="gradient-text">My</span>Mate</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm">Your trusted platform for hiring verified local drivers. Safe, reliable, and built for your convenience.</p>
            <div className="flex items-center gap-4 mt-6">
              <span className="flex items-center gap-2 text-sm text-gray-500"><FaPhoneAlt className="w-3.5 h-3.5" /> +1 (555) 123-4567</span>
              <span className="flex items-center gap-2 text-sm text-gray-500"><FaEnvelope className="w-3.5 h-3.5" /> hello@mymate.app</span>
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">For Users</h4>
            <div className="space-y-3 text-sm">
              <p><Link to="/user/register" className="hover:text-white transition-colors">Create Account</Link></p>
              <p><Link to="/user/login" className="hover:text-white transition-colors">Sign In</Link></p>
              <p><Link to="/drivers" className="hover:text-white transition-colors">Browse Drivers</Link></p>
              <p><a href="#features" className="hover:text-white transition-colors">Features</a></p>
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">For Drivers</h4>
            <div className="space-y-3 text-sm">
              <p><Link to="/driver/register" className="hover:text-white transition-colors">Register</Link></p>
              <p><Link to="/driver/login" className="hover:text-white transition-colors">Sign In</Link></p>
              <p><Link to="/driver/dashboard" className="hover:text-white transition-colors">Dashboard</Link></p>
              <p><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></p>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm">&copy; {new Date().getFullYear()} MyMate. All rights reserved.</div>
      </div>
    </footer>
  );
}