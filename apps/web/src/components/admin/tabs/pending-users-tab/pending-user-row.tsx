"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, Eye, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatarCell, UserEmailCell } from "../../components/UserCells";
import type { PendingUser } from "./types";

// A single pending user row: identity cells plus approve/reject actions
// rendered as buttons (desktop) or a dropdown menu (mobile).
export function PendingUserRow({
  user,
  isAnyActionPending,
  onOpenDetails,
  onApprove,
  onReject,
}: {
  user: PendingUser;
  isAnyActionPending: boolean;
  onOpenDetails: (user: PendingUser) => void;
  onApprove: (userId: string, userName: string, userEmail: string) => void;
  onReject: (userId: string, userName: string, userEmail: string) => void;
}) {
  return (
    <TableRow className="hover:bg-muted/50 transition-colors">
      <TableCell>
        <UserAvatarCell
          name={user.name}
          email={user.email}
          showEmail={!!user.name}
        />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <UserEmailCell email={user.email} />
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className="flex items-center gap-1.5 w-fit font-medium"
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="capitalize">{user.status}</span>
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="text-sm">
          <p>{new Date(user.createdAt).toLocaleDateString()}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(user.createdAt).toLocaleTimeString()}
          </p>
        </div>
      </TableCell>
      <TableCell className="text-right">
        {/* Desktop Actions */}
        <div className="hidden md:flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenDetails(user)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Details
          </Button>
          <Button
            size="sm"
            onClick={() => onApprove(user.id, user.name || "User", user.email)}
            disabled={isAnyActionPending}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onReject(user.id, user.name || "User", user.email)}
            disabled={isAnyActionPending}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        </div>
        {/* Mobile Dropdown Actions */}
        <div className="md:hidden flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isAnyActionPending}
                aria-label="Open user actions menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              className="w-[160px]"
              sideOffset={5}
              collisionPadding={16}
            >
              <DropdownMenuItem
                onClick={() => onOpenDetails(user)}
                className="cursor-pointer"
              >
                <Eye className="h-4 w-4 mr-2" />
                Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  onApprove(user.id, user.name || "User", user.email)
                }
                className="cursor-pointer text-green-600"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onReject(user.id, user.name || "User", user.email)
                }
                className="cursor-pointer text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
