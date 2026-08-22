"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableTableHead, type DomainSortBy } from "@/components/data-table";
import type { SortDirection } from "@/hooks/useServerTable";

type DomainRow = {
  id: string;
  domain: string;
  createdAt: Date | string;
};

// Table of database-configured allowlist domains.
export function DomainsTable({
  domains,
  sortBy,
  sortDir,
  onSort,
  onRemove,
}: {
  domains: DomainRow[];
  sortBy: DomainSortBy;
  sortDir: SortDirection;
  onSort: (column: DomainSortBy) => void;
  onRemove: (domainId: string, domainName: string) => void;
}) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column="domain"
              currentSortBy={sortBy}
              currentSortDir={sortDir}
              onSort={onSort}
            >
              Domain
            </SortableTableHead>
            <SortableTableHead
              column="createdAt"
              currentSortBy={sortBy}
              currentSortDir={sortDir}
              onSort={onSort}
            >
              Added On
            </SortableTableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {domains.map((domain) => (
            <TableRow key={domain.id}>
              <TableCell className="font-medium">
                <Badge variant="secondary" className="font-mono">
                  {domain.domain}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(domain.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onRemove(domain.id, domain.domain)}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
