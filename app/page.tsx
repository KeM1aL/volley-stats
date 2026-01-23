import { Button } from "@/components/ui/button";
import { MoveRight } from "lucide-react";
import { FeaturesSection } from "@/components/landing/features-section";
import Link from "next/link";

export default async function Home() {

  return (
    <div className="flex flex-col gap-8">
      <section className="text-center py-8 sm:py-12 md:py-20 px-4">
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-3 sm:mb-4">
          Volleyball Statistics for Dummies
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto">
          Track, analyze, and improve your team's performance with simple analytics
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
          <Button asChild size="lg" className="group w-full sm:w-auto">
            <Link href="/auth">
              Get Started
              <MoveRight className="inline-block w-5 h-5 ml-2 transition-transform duration-300 ease-in-out group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="#features">
              Learn More
            </Link>
          </Button>
        </div>
      </section>

      <FeaturesSection />
    </div>
  );
}