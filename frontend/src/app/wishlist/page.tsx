"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";

import { ProductCardSkeleton, ProductGrid } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import { useMounted, useUser } from "@/lib/hooks";
import type { Paginated, Product } from "@/lib/types";
import { useWishlist } from "@/stores/ui";

export default function WishlistPage() {
  const ids = useWishlist((s) => s.ids);
  const mounted = useMounted();
  const { user } = useUser();
  const { data, isLoading } = useQuery({
    queryKey: ["wishlist-products", [...ids].sort().join(",")],
    queryFn: () => api<Paginated<Product>>("/products/", { params: { ids: ids.join(","), page_size: 60 } }),
    enabled: mounted && ids.length > 0,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    document.title = "Wishlist | Haya & Haze";
  }, []);

  const products = (data?.results ?? []).filter((p) => ids.includes(p.id));
  return (
    <div className="container-page py-10 md:py-14">
      <p className="eyebrow mb-3">Saved for later</p>
      <h1 className="mb-3 text-5xl md:text-6xl">Your wishlist</h1>
      {!user && mounted && ids.length > 0 && (
        <p className="mb-8 text-mocha">
          Saved on this device. <Link href="/account/login?next=/wishlist" className="underline underline-offset-4">Sign in</Link> to keep it everywhere.
        </p>
      )}
      <div className="mt-8">
        {!mounted || (isLoading && ids.length > 0) ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">{[0, 1, 2, 3].map((i) => <ProductCardSkeleton key={i} />)}</div>
        ) : products.length === 0 ? (
          <EmptyState
            title="Nothing saved yet" text="Tap the heart on anything you love and it will wait for you here."
            action={<Button href="/collections/all">Find something lovely</Button>}
          />
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </div>
  );
}
