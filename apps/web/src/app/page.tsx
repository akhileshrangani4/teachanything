import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ProcessSection from "@/components/landing/ProcessSection";
import ChatbotsShowcase from "@/components/landing/ChatbotsShowcase";
import StatsSection from "@/components/landing/StatsSection";
import TechnologySection from "@/components/landing/TechnologySection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import InfoSection from "@/components/landing/InfoSection";
import TrustedBySection from "@/components/landing/TrustedBySection";
import SupportUsSection from "@/components/landing/SupportUsSection";
import Footer from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white overflow-x-clip">
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
      {/* Trusted By Section */}
      <TrustedBySection />
      {/* Support Us Section */}
      <SupportUsSection />
      {/* Footer */}
      <Footer />
    </div>
  );
}
