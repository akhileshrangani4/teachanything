"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { validateDomainForAllowlist } from "@/lib/domain-validation";
import { TableToolbar, type DomainSortBy } from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { PaginationControls } from "../../dashboard/files/PaginationControls";
import { StatsHeader } from "../components/StatsHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";
import { DomainsInfoAlert } from "./allowed-domains-tab/domains-info-alert";
import { AddDomainForm } from "./allowed-domains-tab/add-domain-form";
import { EnvDomainsSection } from "./allowed-domains-tab/env-domains-section";
import { DomainsTable } from "./allowed-domains-tab/domains-table";

const ITEMS_PER_PAGE = 50;

export function AllowedDomainsTab() {
  const [newDomain, setNewDomain] = useState("");
  const [isAddingDomain, setIsAddingDomain] = useState(false);

  const { state, searchInput, actions, queryParams } =
    useServerTable<DomainSortBy>(
      { defaultSortBy: "createdAt", defaultSortDir: "desc" },
      ITEMS_PER_PAGE,
    );

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    domainId: string | null;
    domainName: string | null;
  }>({
    isOpen: false,
    domainId: null,
    domainName: null,
  });

  const {
    data: domainsData,
    isLoading: domainsLoading,
    isFetching,
    refetch,
  } = trpc.admin.listDomains.useQuery(
    {
      page: state.page + 1, // listDomains uses 1-based pages
      limit: ITEMS_PER_PAGE,
      search: queryParams.search,
      sortBy: queryParams.sortBy,
      sortDir: queryParams.sortDir,
    },
    {
      placeholderData: keepPreviousData,
    },
  );

  const domains = domainsData?.domains ?? [];
  const pagination = domainsData?.pagination;
  const totalCount = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const { data: envDomains } = trpc.admin.getEnvDomains.useQuery();

  const addDomainMutation = trpc.admin.addDomain.useMutation({
    onSuccess: () => {
      toast.success("Domain added successfully");
      setNewDomain("");
      setIsAddingDomain(false);
      actions.reset(); // Reset to first page to see the new domain
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add domain");
    },
  });

  const removeDomainMutation = trpc.admin.removeDomain.useMutation({
    onSuccess: () => {
      toast.success("Domain removed successfully");
      setDeleteDialog({ isOpen: false, domainId: null, domainName: null });
      // Stay on current page unless it becomes empty, then go to previous page
      if (domains.length === 1 && state.page > 0) {
        actions.setPage(state.page - 1);
      }
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove domain");
    },
  });

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      toast.error("Please enter a domain");
      return;
    }

    const trimmedDomain = newDomain.trim();

    // Use shared validation utility (same logic as backend)
    const validation = validateDomainForAllowlist(trimmedDomain);
    if (!validation.valid) {
      toast.error("Invalid domain", {
        description: validation.reason,
        duration: 8000,
      });
      return;
    }

    await addDomainMutation.mutateAsync({
      domain: trimmedDomain,
    });
  };

  const handleRemoveDomain = async () => {
    if (!deleteDialog.domainId) return;

    await removeDomainMutation.mutateAsync({ domainId: deleteDialog.domainId });
  };

  const cancelAddDomain = () => {
    setIsAddingDomain(false);
    setNewDomain("");
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <StatsHeader
            title="Allowed Email Domains"
            description="Manage email domains that are allowed to register"
            stats={[{ value: totalCount, label: "Total", highlight: true }]}
          />
        </CardHeader>
        <CardContent>
          <DomainsInfoAlert />

          {/* Add domain form */}
          <AddDomainForm
            newDomain={newDomain}
            onNewDomainChange={setNewDomain}
            isAdding={isAddingDomain}
            isPending={addDomainMutation.isPending}
            onStart={() => setIsAddingDomain(true)}
            onCancel={cancelAddDomain}
            onSubmit={handleAddDomain}
          />

          {/* Database Domains */}
          <div className="space-y-3 mb-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Database Domains</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Domains added through the admin panel (can be added/removed)
              </p>
            </div>

            <TableToolbar
              searchValue={searchInput}
              onSearchChange={actions.setSearch}
              placeholder="Search domains..."
              totalCount={totalCount}
              visibleCount={domains.length}
              itemLabel="domain"
              isLoading={isFetching && !domainsLoading}
            />

            {domainsLoading && !domainsData ? (
              <TableSkeleton
                header={
                  <>
                    <Skeleton className="h-4 w-16 shrink-0" />
                    <Skeleton className="h-4 w-20 shrink-0 hidden sm:block" />
                    <Skeleton className="h-4 w-14 shrink-0 ml-auto" />
                  </>
                }
                row={
                  <>
                    <Skeleton className="h-5 w-28 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-24 shrink-0 hidden sm:block" />
                    <Skeleton className="h-8 w-20 rounded-md shrink-0 ml-auto" />
                  </>
                }
              />
            ) : domains.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {state.search || searchInput
                  ? "No domains match your search"
                  : 'No database domains configured. Use the "Add Domain" button above to add domains.'}
              </div>
            ) : (
              <DomainsTable
                domains={domains}
                sortBy={state.sortBy}
                sortDir={state.sortDir}
                onSort={actions.toggleSort}
                onRemove={(domainId, domainName) =>
                  setDeleteDialog({
                    isOpen: true,
                    domainId,
                    domainName,
                  })
                }
              />
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationControls
                currentPage={state.page}
                totalPages={totalPages}
                onPageChange={actions.setPage}
              />
            )}
          </div>

          {/* Environment Domains */}
          {envDomains && envDomains.length > 0 && (
            <EnvDomainsSection domains={envDomains} />
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialog({
              isOpen: false,
              domainId: null,
              domainName: null,
            });
          }
        }}
        onConfirm={handleRemoveDomain}
        title="Remove Allowed Domain"
        description={`Are you sure you want to remove "${deleteDialog.domainName}"? Users with this domain will no longer be able to register.`}
        confirmText="Remove"
        variant="destructive"
        loading={removeDomainMutation.isPending}
      />
    </>
  );
}
