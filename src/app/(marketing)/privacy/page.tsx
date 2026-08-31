import { type Metadata } from "next";
import Link from "next/link";

import {
  LegalList,
  LegalPage,
  LegalSection,
} from "~/components/marketing/legal";

/**
 * The address Google's OAuth consent screen already publishes as LessonPlay's
 * support contact. Change it here and in `terms/page.tsx` together — Google
 * checks that the policy names a way to reach a human.
 */
const CONTACT = "rishabhsingh30july@gmail.com";

export const metadata: Metadata = {
  title: "Privacy Policy — LessonPlay",
  description:
    "What LessonPlay collects, who processes it, and how to have it deleted.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="31 August 2026"
      lead="LessonPlay turns a chemistry chapter into a playable lab simulation. This page explains what we collect while you do that, who else touches it, and how to get it deleted."
    >
      <LegalSection heading="Who this applies to">
        <p>
          This policy covers people who sign in to LessonPlay at{" "}
          <span className="text-foreground">lessonplay.space</span> and build
          games in the studio — typically teachers and other educators.
        </p>
        <p>
          It does <span className="text-foreground">not</span> require anything
          from students. A published game is a self-contained page shared as a
          link; playing one needs no account, and we collect no name, email, or
          score from the person playing it.
        </p>
      </LegalSection>

      <LegalSection heading="What we collect">
        <LegalList>
          <li>
            <span className="text-foreground">Account details.</span> When you
            sign up we receive your email address, and — if you use Google
            sign-in — your name and profile picture from your Google account. We
            never receive your Google password.
          </li>
          <li>
            <span className="text-foreground">What you create.</span> The
            messages you send in the studio, the files you upload as reference
            material, and the games generated from them.
          </li>
          <li>
            <span className="text-foreground">Published games.</span> Each time
            you publish, we store that version&apos;s source and its built page,
            plus a small record of when it was published and the label you gave
            it.
          </li>
          <li>
            <span className="text-foreground">Technical logs.</span> Our hosting
            and database providers record standard request data — IP address,
            browser type, timestamps — to run and secure the service.
          </li>
        </LegalList>
        <p>
          We do not collect payment details, because the beta is free. We do not
          buy data about you, and we do not run advertising or third-party
          tracking scripts.
        </p>
      </LegalSection>

      <LegalSection heading="How we use it">
        <p>
          To run the product and nothing more: to authenticate you, to keep your
          conversations and games available across sessions, to build and
          preview what you ask for, and to diagnose failures when something
          breaks. We do not sell your data or share it for advertising.
        </p>
      </LegalSection>

      <LegalSection heading="Who processes it on our behalf">
        <p>
          LessonPlay is built on third-party infrastructure. These providers
          process your data only to deliver the service:
        </p>
        <LegalList>
          <li>
            <span className="text-foreground">Clerk</span> — accounts, sign-in,
            and sessions.
          </li>
          <li>
            <span className="text-foreground">Vercel</span> — application
            hosting, and the AI Gateway that routes prompts to the model.
          </li>
          <li>
            <span className="text-foreground">Neon</span> — the Postgres
            database holding your conversations and publish records.
          </li>
          <li>
            <span className="text-foreground">Cloudflare R2</span> — storage for
            uploaded files and published game bundles.
          </li>
          <li>
            <span className="text-foreground">Daytona</span> — the isolated
            sandboxes where your game is built and tested.
          </li>
          <li>
            <span className="text-foreground">
              The AI model provider behind your session
            </span>{" "}
            — receives your prompts and any files you attach in order to
            generate a response.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Published games and uploads are reachable by link">
        <p>
          This one matters, so it is stated plainly. Files you upload and games
          you publish are stored at long, randomly-generated web addresses.
          Those addresses are not listed, indexed, or guessable — but they are
          not password-protected either.{" "}
          <span className="text-foreground">
            Anyone who has the link can open the file or play the game.
          </span>
        </p>
        <p>
          That is what makes a game shareable with a class in one link. It also
          means you should not upload anything you would not be comfortable
          having a link to — in particular, do not upload documents containing
          students&apos; personal information.
        </p>
      </LegalSection>

      <LegalSection heading="AI processing">
        <p>
          What you type in the studio, and any file you attach, is sent to an AI
          model provider to produce a response. Your conversation history is
          stored so the assistant has context on later turns. Treat the studio
          as you would any cloud document: do not paste personal data about
          identifiable students into it.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          LessonPlay accounts are for educators and adults. The service is not
          directed at children, and you should not create an account for a child
          or on a child&apos;s behalf. Because playing a published game requires
          no account and collects nothing, students can use what you build
          without ever giving us data.
        </p>
        <p>
          If you believe a child has created an account, write to us and we will
          delete it.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies and local storage">
        <p>
          We use cookies set by Clerk to keep you signed in — these are
          necessary for the service to function. Your browser also stores small
          preferences locally, such as your light or dark theme choice. There
          are no advertising or analytics cookies.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p>
          Your account, conversations, and published games are kept while your
          account is active, so that you can come back to a game months later.
          When you ask us to delete your account we remove your conversations,
          uploads, and published games. Backups and provider logs may retain
          copies for a short period before they age out.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <p>
          You can ask us to show you what we hold about you, correct it, delete
          it, or send you a copy. Email{" "}
          <a
            className="text-lp-violet underline underline-offset-4"
            href={`mailto:${CONTACT}`}
          >
            {CONTACT}
          </a>{" "}
          from the address on your account and we will act on it. Deleting your
          account removes your content — there is no undo, so export anything
          you want to keep first.
        </p>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          Traffic is encrypted in transit, your data sits behind authenticated
          access scoped to your account, and generated code runs in isolated
          sandboxes rather than on our servers. No service can promise perfect
          security, and this one is in beta — please do not store anything
          irreplaceable here without your own copy.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          LessonPlay is early and changing quickly, so this policy will change
          too. We will update the date at the top whenever it does, and material
          changes will be announced in the product.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about privacy, or a deletion request:{" "}
          <a
            className="text-lp-violet underline underline-offset-4"
            href={`mailto:${CONTACT}`}
          >
            {CONTACT}
          </a>
          . See also our{" "}
          <Link
            className="text-lp-violet underline underline-offset-4"
            href="/terms"
          >
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
