import { redirect } from "next/navigation";

// Branch B folds the home surface into the /chats harness (it shows the prompt
// when there is no ?id=), so the landing route just points there.
export default function HomePage() {
  redirect("/chats");
}
