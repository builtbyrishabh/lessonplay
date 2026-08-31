import { type Metadata } from "next";

import { Classroom } from "~/components/marketing/classroom";
import { Faq } from "~/components/marketing/faq";
import { FinalCta } from "~/components/marketing/final-cta";
import { GameTypes } from "~/components/marketing/game-types";
import { Gate } from "~/components/marketing/gate";
import { Hero } from "~/components/marketing/hero";
import { HowItWorks } from "~/components/marketing/how-it-works";
import { StudioDemo } from "~/components/marketing/studio-demo";

export const metadata: Metadata = {
  title: "LessonPlay — turn a chemistry chapter into a game your class plays",
  description:
    "Describe a lesson and LessonPlay builds a playable chemistry lab simulation — play-tested before you see it, and shared with your class as one link. Free beta.",
  openGraph: {
    title: "LessonPlay — your chemistry chapter, as a game",
    description:
      "Describe a lesson. Get a real, playable lab simulation your students can reason their way through. Free beta.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <StudioDemo />
      <HowItWorks />
      <GameTypes />
      <Gate />
      <Classroom />
      <Faq />
      <FinalCta />
    </>
  );
}
