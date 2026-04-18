import { redirect } from "next/navigation";

/** Korte URL: alles op `/user` (Log een taak). */
export default function TakenRedirectPage() {
  redirect("/user");
}
