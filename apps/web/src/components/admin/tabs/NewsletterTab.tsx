"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { StatsHeader } from "../components/StatsHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";
import { Send } from "lucide-react";

export function NewsletterTab() {
  const [search, setSearch] = useState("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const {
    data: subscribers,
    isLoading,
    isError: isSubscribersError,
  } = trpc.newsletter.listSubscribers.useQuery();

  const sendBroadcast = trpc.newsletter.sendBroadcast.useMutation({
    onSuccess: () => {
      toast.success("Newsletter sent successfully");
      setSendDialogOpen(false);
      setSubject("");
      setBody("");
    },
    onError: () => {
      toast.error(
        "Newsletter could not be sent. Check Resend sender domain configuration.",
      );
    },
  });

  const handleSend = () => {
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!body.trim()) {
      toast.error("Body is required");
      return;
    }
    sendBroadcast.mutate({ subject: subject.trim(), body: body.trim() });
  };

  const filtered = (subscribers ?? []).filter(
    (s) =>
      !search ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.firstName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const activeCount = (subscribers ?? []).filter((s) => !s.unsubscribed).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <StatsHeader
            title="Newsletter"
            description="Manage subscribers and send newsletters via Resend"
            stats={[
              {
                value: activeCount,
                label: "Active subscribers",
                highlight: true,
              },
              {
                value: (subscribers ?? []).length,
                label: "Total contacts",
              },
            ]}
          />
        </CardHeader>
        <CardContent>
          {/* Actions toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 justify-between items-start sm:items-center">
            <Input
              placeholder="Search subscribers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Button
              onClick={() => setSendDialogOpen(true)}
              disabled={isSubscribersError}
              title={
                isSubscribersError
                  ? "Subscriber list failed to load"
                  : undefined
              }
            >
              <Send className="mr-2 h-4 w-4" />
              Send Newsletter
            </Button>
          </div>

          {/* Subscriber table */}
          {isLoading ? (
            <TableSkeleton
              header={
                <>
                  <Skeleton className="h-4 w-40 shrink-0" />
                  <Skeleton className="h-4 w-24 shrink-0 hidden sm:block" />
                  <Skeleton className="h-4 w-20 shrink-0 hidden md:block" />
                  <Skeleton className="h-4 w-16 shrink-0 ml-auto" />
                </>
              }
              row={
                <>
                  <Skeleton className="h-4 w-48 shrink-0" />
                  <Skeleton className="h-4 w-24 shrink-0 hidden sm:block" />
                  <Skeleton className="h-4 w-20 shrink-0 hidden md:block" />
                  <Skeleton className="h-5 w-20 rounded-full shrink-0 ml-auto" />
                </>
              }
            />
          ) : isSubscribersError ? (
            <div className="text-center py-10 text-destructive">
              Failed to load subscribers. Please refresh and try again.
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {search
                ? "No subscribers match your search."
                : "No subscribers yet. Share the newsletter signup on your homepage!"}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden sm:table-cell">Name</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Subscribed
                    </TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell className="font-medium">
                        {subscriber.email}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {subscriber.firstName
                          ? `${subscriber.firstName}${subscriber.lastName ? " " + subscriber.lastName : ""}`
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {new Date(subscriber.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            subscriber.unsubscribed ? "secondary" : "default"
                          }
                        >
                          {subscriber.unsubscribed
                            ? "Unsubscribed"
                            : "Subscribed"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send newsletter dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Newsletter</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nl-subject">Subject</Label>
              <Input
                id="nl-subject"
                placeholder="Your newsletter subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sendBroadcast.isPending}
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nl-body">Body</Label>
              <Textarea
                id="nl-body"
                placeholder="Write your newsletter content here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={sendBroadcast.isPending}
                rows={8}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Plain text. Each line becomes a paragraph.
              </p>
            </div>

            {/* Preview */}
            {(subject || body) && (
              <div className="rounded-md border bg-muted/40 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Preview
                </p>
                {subject && <p className="font-semibold text-sm">{subject}</p>}
                {body && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {body}
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {subscribers !== undefined ? (
                <>
                  This will send to{" "}
                  <strong>
                    {activeCount} active subscriber
                    {activeCount !== 1 ? "s" : ""}
                  </strong>{" "}
                  via Resend. Resend handles unsubscribe links automatically.
                </>
              ) : (
                "Subscriber count unavailable. Resend handles unsubscribe links automatically."
              )}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSendDialogOpen(false)}
              disabled={sendBroadcast.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={
                sendBroadcast.isPending || !subject.trim() || !body.trim()
              }
            >
              {sendBroadcast.isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
