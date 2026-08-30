import { redirect } from "next/navigation";

// The signed-in app lives at /chats (the query-param SPA). This landing route
// just points there for now; a real marketing/login home will replace it later.
export default function HomePage() {
  redirect("/chats");
}
