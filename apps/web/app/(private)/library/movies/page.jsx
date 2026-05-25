import { redirect } from "next/navigation";

export default function MoviesRedirect() {
  redirect("/library/films");
}
