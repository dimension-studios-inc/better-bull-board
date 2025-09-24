"use client";

import { Filter, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function RunsFilters() {
  const [filters, setFilters] = useState({
    queue: "all",
    status: "all",
    search: "",
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by job ID, name, or error..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="pl-10"
              />
            </div>
          </div>

          <Select
            value={filters.queue}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, queue: value }))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Queues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Queues</SelectItem>
              <SelectItem value="email">email</SelectItem>
              <SelectItem value="image-processing">image-processing</SelectItem>
              <SelectItem value="notifications">notifications</SelectItem>
              <SelectItem value="reports">reports</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.status}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, status: value }))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="delayed">Delayed</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
