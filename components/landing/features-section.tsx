'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Volleyball, Trophy, BarChart3, Users } from "lucide-react";
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const features = [
  {
    title: "Match Tracking",
    description: "Real-time statistics and scoring",
    icon: Volleyball,
    content: "Track serves, attacks, blocks, and more during live matches with our intuitive interface.",
    image: "https://placehold.co/1280x720/E2E8F0/4A5568?text=Match+Tracking"
  },
  {
    title: "Team Management",
    description: "Organize players and teams",
    icon: Trophy,
    content: "Manage multiple teams, player rosters, and track individual performance metrics.",
    image: "https://placehold.co/1280x720/E2E8F0/4A5568?text=Team+Management"
  },
  {
    title: "Advanced Analytics",
    description: "Detailed performance insights",
    icon: BarChart3,
    content: "Analyze team and player statistics with comprehensive charts and reports.",
    image: "https://placehold.co/1280x720/E2E8F0/4A5568?text=Advanced+Analytics"
  },
  {
    title: "Collaboration",
    description: "Share and export data",
    icon: Users,
    content: "Export statistics to CSV/PDF and share match results with team members.",
    image: "https://placehold.co/1280x720/E2E8F0/4A5568?text=Collaboration"
  }
];

export function FeaturesSection() {
  const [selectedFeature, setSelectedFeature] = useState(features[0]);
  const [userInteracted, setUserInteracted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userInteracted) {
      intervalRef.current = setInterval(() => {
        setSelectedFeature((prevFeature) => {
          const currentIndex = features.findIndex(f => f.title === prevFeature.title);
          const nextIndex = (currentIndex + 1) % features.length;
          return features[nextIndex];
        });
      }, 3000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userInteracted]);

  const handleFeatureClick = (feature: typeof features[0]) => {
    setUserInteracted(true);
    setSelectedFeature(feature);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  return (
    <section id="features" className="flex flex-col gap-8">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className={cn(
              "cursor-pointer transition-all duration-300",
              selectedFeature.title === feature.title
                ? "ring-2 ring-primary"
                : "hover:shadow-lg"
            )}
            onClick={() => handleFeatureClick(feature)}
          >
            <CardHeader>
              <feature.icon className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>{feature.content}</CardContent>
          </Card>
        ))}
      </div>
      <div className="m-5 min-h-[480px]">
        
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedFeature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="p-4 flex items-center justify-center">
                  <Image
                      src={selectedFeature.image}
                      alt={selectedFeature.title}
                      width={1280}
                      height={720}
                      className="rounded-lg"
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          
      </div>
    </section>
  );
}