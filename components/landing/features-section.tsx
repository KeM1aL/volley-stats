'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Volleyball, Trophy, BarChart3, Users } from "lucide-react";
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

export function FeaturesSection() {
  const t = useTranslations('landing');

  const features = [
    {
      key: 'matchTracking',
      title: t('features.matchTracking.title'),
      description: t('features.matchTracking.description'),
      icon: Volleyball,
      content: t('features.matchTracking.content'),
      image: "https://placehold.co/1280x720/E2E8F0/4A5568?text=Match+Tracking"
    },
    {
      key: 'teamManagement',
      title: t('features.teamManagement.title'),
      description: t('features.teamManagement.description'),
      icon: Trophy,
      content: t('features.teamManagement.content'),
      image: "https://placehold.co/1280x720/E2E8F0/4A5568?text=Team+Management"
    },
    {
      key: 'analytics',
      title: t('features.analytics.title'),
      description: t('features.analytics.description'),
      icon: BarChart3,
      content: t('features.analytics.content'),
      image: "https://placehold.co/1280x720/E2E8F0/4A5568?text=Advanced+Analytics"
    },
    {
      key: 'collaboration',
      title: t('features.collaboration.title'),
      description: t('features.collaboration.description'),
      icon: Users,
      content: t('features.collaboration.content'),
      image: "https://placehold.co/1280x720/E2E8F0/4A5568?text=Collaboration"
    }
  ];

  const [selectedFeature, setSelectedFeature] = useState(features[0]);
  const [userInteracted, setUserInteracted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userInteracted) {
      intervalRef.current = setInterval(() => {
        setSelectedFeature((prevFeature) => {
          const currentIndex = features.findIndex(f => f.key === prevFeature.key);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {features.map((feature) => (
          <Card
            key={feature.key}
            className={cn(
              "cursor-pointer transition-all duration-300",
              selectedFeature.key === feature.key
                ? "ring-2 ring-primary"
                : "hover:shadow-lg"
            )}
            onClick={() => handleFeatureClick(feature)}
          >
            <CardHeader className="pb-3">
              <feature.icon className="h-8 w-8 mb-2 text-primary" />
              <CardTitle className="text-lg">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{feature.content}</CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 md:mt-6 min-h-[200px] sm:min-h-[280px] md:min-h-[480px]">

            <AnimatePresence mode="wait">
              <motion.div
                key={selectedFeature.key}
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
                      className="rounded-lg w-full h-auto max-w-4xl"
                  />
                </div>
              </motion.div>
            </AnimatePresence>

      </div>
    </section>
  );
}