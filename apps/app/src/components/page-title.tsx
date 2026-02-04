"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function PageTitle({
  title,
  description,
  withBackButton,
}: {
  title: string;
  description: string;
  withBackButton?: boolean;
}) {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center gap-2">
        {withBackButton && (
          <Button variant="ghost" size={"sm"} onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
      </div>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
