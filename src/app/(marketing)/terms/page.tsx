import { type Metadata } from "next";
import Link from "next/link";

import {
  LegalList,
  LegalPage,
  LegalSection,
} from "~/components/marketing/legal";

/** Keep in sync with `privacy/page.tsx`. */
const CONTACT = "rishabhsingh30july@gmail.com";

export const metadata: Metadata = {
  title: "Terms of Service — LessonPlay",
  description:
    "The terms you agree to when you use LessonPlay to build and share chemistry games.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="31 August 2026"
      lead="These terms cover your use of LessonPlay. By creating an account or using the studio, you agree to them. If you do not, please do not use the service."
    >
      <LegalSection heading="LessonPlay is in beta">
        <p>
          This is an early product under active development. Features will
          change, appear, and disappear. Things will occasionally break, games
          may fail to build, and we may need to take the service down without
          notice. Please keep your own copy of anything you would be upset to
          lose.
        </p>
      </LegalSection>

      <LegalSection heading="Who can use it">
        <p>
          You must be at least 18, or old enough to enter a contract where you
          live, and you must be using LessonPlay for teaching, learning, or
          building educational material. Accounts are for people, not shared
          logins — one account per person.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <p>
          You are responsible for what happens under your account and for
          keeping access to it secure. Tell us promptly if you think someone
          else has got in. We may suspend an account that is being used in
          breach of these terms.
        </p>
      </LegalSection>

      <LegalSection heading="What you put in stays yours">
        <p>
          You keep ownership of the lesson material, prompts, and files you
          bring to LessonPlay. You grant us only the permission we need to run
          the service — to store your content, send it to our infrastructure and
          model providers, and build, preview, and serve the games you ask for.
        </p>
        <p>
          You confirm that you have the right to upload what you upload. Do not
          upload copyrighted material you are not licensed to use, and do not
          upload documents containing students&apos; personal information.
        </p>
      </LegalSection>

      <LegalSection heading="Games you generate">
        <p>
          As between you and us, the games LessonPlay generates for you are
          yours to use, adapt, and share with your classes. Note that similar
          prompts can produce similar output for other people, so we cannot
          promise a generated game is unique to you.
        </p>
        <p className="text-foreground">
          Check the science before you put a game in front of students.
        </p>
        <p>
          LessonPlay play-tests every game it publishes — it verifies that the
          game is winnable, is not guessable, and can actually be completed
          through its own rules. That is a test of the game as a game. It is not
          a review by a chemistry teacher, and it cannot tell you whether a
          reaction, a value, or an explanation is scientifically correct or
          appropriate for your syllabus. You are the teacher in the loop.
        </p>
      </LegalSection>

      <LegalSection heading="Publishing and shared links">
        <p>
          Publishing a game puts it at a long, randomly-generated web address so
          you can share it with a class in one link. That address is unlisted
          but not password-protected — anyone holding the link can play the
          game. Publish accordingly, and see the{" "}
          <Link
            className="text-lp-violet underline underline-offset-4"
            href="/privacy"
          >
            Privacy Policy
          </Link>{" "}
          for the detail.
        </p>
      </LegalSection>

      <LegalSection heading="How not to use LessonPlay">
        <LegalList>
          <li>
            Breaking the law, infringing someone&apos;s rights, or violating
            someone&apos;s privacy.
          </li>
          <li>
            Generating content that is harmful, hateful, harassing, sexual, or
            otherwise inappropriate for a classroom.
          </li>
          <li>
            Trying to break out of the build sandbox, attack our infrastructure
            or our providers, or reach data that is not yours.
          </li>
          <li>
            Automated scraping, reselling access, or hammering the service in a
            way that degrades it for others.
          </li>
          <li>
            Reverse-engineering the service, except where the law says you may.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Availability">
        <p>
          The beta is free, and comes with no uptime commitment or support
          guarantee. We may change, limit, or discontinue any part of the
          service. If we ever have to shut LessonPlay down, we will give
          reasonable notice so you can export your games.
        </p>
      </LegalSection>

      <LegalSection heading="Ending it">
        <p>
          You can stop using LessonPlay at any time and ask us to delete your
          account. We may suspend or close an account that breaches these terms,
          or that puts the service or other users at risk. On deletion your
          content is removed, and that cannot be undone.
        </p>
      </LegalSection>

      <LegalSection heading="No warranties">
        <p>
          LessonPlay is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without warranties of any kind, express or implied,
          including fitness for a particular purpose and non-infringement. We do
          not warrant that the service will be uninterrupted or error-free, or
          that generated content will be accurate, complete, or suitable for
          your classroom.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          To the fullest extent the law allows, LessonPlay is not liable for
          indirect, incidental, special, or consequential damages, or for lost
          data, lost profits, or lost teaching time arising from your use of the
          service. Since the beta is provided free of charge, our total
          liability to you is limited to the greater of the amount you have paid
          us — currently nothing — or ₹5,000.
        </p>
        <p>
          Nothing here excludes liability that cannot lawfully be excluded.
        </p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>
          These terms are governed by the laws of India, and the courts of India
          have exclusive jurisdiction over any dispute arising from them.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>
          We may update these terms as the product develops. The date at the top
          shows when they last changed, and continuing to use LessonPlay after a
          change means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these terms:{" "}
          <a
            className="text-lp-violet underline underline-offset-4"
            href={`mailto:${CONTACT}`}
          >
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
