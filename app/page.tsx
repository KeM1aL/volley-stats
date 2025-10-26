import { Button } from "@/components/ui/button";
import { MoveRight } from "lucide-react";
import { FeaturesSection } from "@/components/landing/features-section";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-8">
      <section className="text-center py-12 md:py-20">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Volleyball Statistics for Dummies
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Track, analyze, and improve your team's performance with simple analytics
        </p>
        {!user && <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" className="group">
            <Link href="/auth">
              Get Started
              <MoveRight className="inline-block w-5 h-5 ml-2 transition-transform duration-300 ease-in-out group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#features">
              Learn More
            </Link>
          </Button>
        </div>}
      </section>

      <FeaturesSection />
    </div>
  );
}