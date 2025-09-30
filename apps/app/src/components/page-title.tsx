import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";

export function PageTitle({
  title,
  description,
  withRunsLink,
}: {
  title: string;
  description: string;
  withRunsLink?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {withRunsLink && (
          <Link href="/runs">
            <Button variant="ghost" size={"sm"}>
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
        )}
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
      </div>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
