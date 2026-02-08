"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PendingUsersTab } from "@/components/admin/tabs/PendingUsersTab";
import { AllChatbotsTab } from "@/components/admin/tabs/AllChatbotsTab";
import { AllowedDomainsTab } from "@/components/admin/tabs/AllowedDomainsTab";
import { AllUsersTab } from "@/components/admin/tabs/AllUsersTab";
import { Shield, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function AdminPage() {
  const [isExporting, setIsExporting] = useState(false);
  const utils = trpc.useUtils();

  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      // Dynamic import to reduce bundle size
      const XLSX = await import("xlsx");

      const data = await utils.admin.exportAdminData.fetch();

      // Check if there's any data to export
      if (
        data.users.length === 0 &&
        data.chatbots.length === 0 &&
        data.domains.length === 0
      ) {
        toast.info("No data to export");
        return;
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Format date helper
      const formatDate = (date: Date | string | null | undefined): string => {
        if (!date) return "";
        return new Date(date).toISOString().split("T")[0] ?? "";
      };

      // Users sheet
      const usersData = data.users.map((user) => ({
        Name: user.name || "",
        Email: user.email,
        Title: user.title || "",
        "Institutional Affiliation": user.institutionalAffiliation || "",
        Department: user.department || "",
        "University Webpage": user.facultyWebpage || "",
        Country: user.country || "",
        Role: user.role,
        Status: user.status,
        Registered: formatDate(user.createdAt),
      }));
      const usersSheet = XLSX.utils.json_to_sheet(usersData);
      XLSX.utils.book_append_sheet(workbook, usersSheet, "Users");

      // Chatbots sheet
      const chatbotsData = data.chatbots.map((chatbot) => ({
        Name: chatbot.name,
        Description: chatbot.description || "",
        Model: chatbot.model,
        "Owner Name": chatbot.ownerName || "",
        "Owner Email": chatbot.ownerEmail || "",
        Featured: chatbot.featured ? "Yes" : "No",
        "Sharing Enabled": chatbot.sharingEnabled ? "Yes" : "No",
        "Custom Author Name": chatbot.customAuthorName || "",
        "File Count": chatbot.fileCount,
        Created: formatDate(chatbot.createdAt),
      }));
      const chatbotsSheet = XLSX.utils.json_to_sheet(chatbotsData);
      XLSX.utils.book_append_sheet(workbook, chatbotsSheet, "Chatbots");

      // Domains sheet
      const domainsData = data.domains.map((domain) => ({
        Domain: domain.domain,
        "Added On": formatDate(domain.createdAt),
      }));
      const domainsSheet = XLSX.utils.json_to_sheet(domainsData);
      XLSX.utils.book_append_sheet(workbook, domainsSheet, "Domains");

      // Generate and download file
      const fileName = `admin-export-${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Export complete");
    } catch (error) {
      console.error("Failed to export admin data:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  }, [utils.admin.exportAdminData]);

  return (
    <div className="flex-1 p-4 md:p-8 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <Shield className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">
                Admin Dashboard
              </h1>
            </div>
            <p className="text-muted-foreground mt-2 text-base md:text-lg">
              Manage users, chatbots, and system settings
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="shrink-0"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4 md:space-y-6">
          <TabsList className="bg-muted-foreground/10 border border-border w-full h-auto gap-1 p-1 overflow-x-auto">
            <TabsTrigger value="users" className="text-xs md:text-sm flex-1 min-w-fit">Pending</TabsTrigger>
            <TabsTrigger value="all-users" className="text-xs md:text-sm flex-1 min-w-fit">All Users</TabsTrigger>
            <TabsTrigger value="chatbots" className="text-xs md:text-sm flex-1 min-w-fit">Chatbots</TabsTrigger>
            <TabsTrigger value="domains" className="text-xs md:text-sm flex-1 min-w-fit">Domains</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <PendingUsersTab />
          </TabsContent>

          <TabsContent value="all-users" className="mt-6">
            <AllUsersTab />
          </TabsContent>

          <TabsContent value="chatbots" className="mt-6">
            <AllChatbotsTab />
          </TabsContent>

          <TabsContent value="domains" className="mt-6">
            <AllowedDomainsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
