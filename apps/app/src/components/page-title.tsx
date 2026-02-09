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

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/runs");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        {withBackButton && (
          <Button variant="ghost" size={"sm"} onClick={handleGoBack}>
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
      </div>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
