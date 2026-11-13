import { EmptyState } from "@/components/ui/bits";
import { HomeBlocks } from "@/components/home/HomeBlocks";
import { api } from "@/lib/api/server";

export const revalidate = 60;

export default async function HomePage() {
  const home = await api.home();
  if (!home) {
    return (
      <div className="container-page">
        <EmptyState
          title="The store is almost ready"
          text="The home page has not been published yet. Run `python manage.py seed_demo` in the backend, or publish the Home page in the CMS."
        />
      </div>
    );
  }
  return <HomeBlocks blocks={home.blocks} />;
}
