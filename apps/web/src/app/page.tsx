import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ProcessSection from "@/components/landing/ProcessSection";
import ChatbotsShowcase from "@/components/landing/ChatbotsShowcase";
import StatsSection from "@/components/landing/StatsSection";
import TechnologySection from "@/components/landing/TechnologySection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import InfoSection from "@/components/landing/InfoSection";
import SupportUsSection from "@/components/landing/SupportUsSection";
import NewsletterSignup from "@/components/landing/NewsletterSignup";
import Footer from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <Navbar />
      {/* Hero Section with background image and gradient */}
      <HeroSection />
      {/* Features Section */}
      <FeaturesSection />
      {/* Chatbots Showcase Section */}
      <ChatbotsShowcase />
      {/* Stats Section */}
      <StatsSection />
      {/* Technology Section */}
      <TechnologySection />
      {/* Process Section */}
      <ProcessSection />
      {/* Comparison Section */}
      <ComparisonSection />
      {/* Info Section */}
      <InfoSection />
      {/* Support Us Section */}
      <SupportUsSection />
      {/* Newsletter Signup */}
      <NewsletterSignup />
      {/* Footer */}
      <Footer />
    </div>
  );
}
