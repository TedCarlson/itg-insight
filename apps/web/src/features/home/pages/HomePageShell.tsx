import { getHomePayload } from "../lib/getHomePayload.server";
import HomeHeader from "../components/HomeHeader";
import HomeDestinations from "../components/HomeDestinations";

export default async function HomePageShell() {
  const payload = await getHomePayload();

  return (
    <div className="space-y-4">
      <HomeHeader payload={payload} />
      <HomeDestinations payload={payload} />
    </div>
  );
}