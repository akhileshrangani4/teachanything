"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Shield,
  User,
  Ban,
  CheckCircle,
  Trash2,
  ChevronDown,
  Eye,
  Gauge,
  Pause,
  Play,
} from "lucide-react";
import { OWNER_DAILY_MESSAGE_LIMIT } from "@/lib/constants/rate-limits";
import { UserAvatarCell } from "../components/UserCells";
import { useSetUserChatbotsPaused } from "../hooks/use-set-user-chatbots-paused";
import { UsageMeter } from "@/components/usage-meter/UsageMeter";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: "admin" | "user";
  status: "approved" | "pending" | "rejected";
  title: string | null;
  institutionalAffiliation: string | null;
  department: string | null;
  facultyWebpage: string | null;
  country: string | null;
  dailyMessageLimit: number | null;
  chatbotsPaused: boolean;
  usage: { today: number };
  createdAt: Date | string;
}

interface UserTableRowProps {
  user: UserData;
  isCurrentUser: boolean;
  onViewDetails: (user: UserData) => void;
  /** Opens the usage and limits panel for this user. */
  onOpenUsage: (userId: string) => void;
  onPromote: (userId: string, userName: string, userEmail: string) => void;
  onDemote: (userId: string, userName: string, userEmail: string) => void;
  onDisable: (userId: string, userName: string, userEmail: string) => void;
  onEnable: (userId: string, userName: string, userEmail: string) => void;
  onDelete: (userId: string, userName: string, userEmail: string) => void;
  isAnyActionPending: boolean;
}

export function UserTableRow({
  user,
  isCurrentUser,
  onViewDetails,
  onOpenUsage,
  onPromote,
  onDemote,
  onDisable,
  onEnable,
  onDelete,
  isAnyActionPending,
}: UserTableRowProps) {
  const isAdmin = user.role === "admin";
  const setChatbotsPaused = useSetUserChatbotsPaused();

  return (
    <TableRow
      key={user.id}
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onOpenUsage(user.id)}
    >
      <TableCell>
        <UserAvatarCell
          name={user.name}
          email={user.email}
          showEmail={!!user.name}
          suffix={
            isCurrentUser ? (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                (You)
              </span>
            ) : undefined
          }
        />
      </TableCell>
      <TableCell>
        <Badge
          variant={isAdmin ? "default" : "secondary"}
          className="flex items-center gap-1.5 w-fit font-medium"
        >
          {isAdmin ? (
            <Shield className="h-3.5 w-3.5" />
          ) : (
            <User className="h-3.5 w-3.5" />
          )}
          <span className="capitalize">{user.role}</span>
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Badge
            variant={
              user.status === "approved"
                ? "default"
                : user.status === "pending"
                  ? "secondary"
                  : "destructive"
            }
            className="w-fit font-medium capitalize"
          >
            {user.status}
          </Badge>
          {user.chatbotsPaused && (
            <Badge variant="destructive" className="w-fit text-[10px]">
              Chatbots paused
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <UsageMeter
          used={user.usage.today}
          limit={user.dailyMessageLimit ?? OWNER_DAILY_MESSAGE_LIMIT}
        />
      </TableCell>
      <TableCell
        className="text-right pr-2"
        onClick={(event) => event.stopPropagation()}
      >
        {isCurrentUser ? (
          <span className="text-sm text-muted-foreground italic">
            Current user
          </span>
        ) : (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-between font-medium"
                  disabled={isAnyActionPending}
                >
                  <span>Actions</span>
                  <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                className="w-[210px]"
                sideOffset={5}
                collisionPadding={16}
              >
                {/* View Details */}
                <DropdownMenuItem
                  onClick={() => onViewDetails(user)}
                  className="cursor-pointer"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onOpenUsage(user.id)}
                  className="cursor-pointer"
                >
                  <Gauge className="h-4 w-4 mr-2" />
                  Usage & Limits
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setChatbotsPaused.mutate({
                      userId: user.id,
                      paused: !user.chatbotsPaused,
                    })
                  }
                  className="cursor-pointer"
                >
                  {user.chatbotsPaused ? (
                    <Play className="h-4 w-4 mr-2" />
                  ) : (
                    <Pause className="h-4 w-4 mr-2" />
                  )}
                  {user.chatbotsPaused
                    ? "Resume All Chatbots"
                    : "Pause All Chatbots"}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Role management */}
                {!isAdmin ? (
                  <DropdownMenuItem
                    onClick={() =>
                      onPromote(user.id, user.name || "User", user.email)
                    }
                    className="cursor-pointer hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary transition-colors"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Promote to Admin
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() =>
                      onDemote(user.id, user.name || "User", user.email)
                    }
                    className="cursor-pointer hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary transition-colors"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Demote to User
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {/* Account status management */}
                {user.status === "rejected" ? (
                  <DropdownMenuItem
                    onClick={() =>
                      onEnable(user.id, user.name || "User", user.email)
                    }
                    className="cursor-pointer hover:bg-green-500/10 hover:text-green-600 focus:bg-green-500/10 focus:text-green-600 transition-colors dark:hover:text-green-400 dark:focus:text-green-400"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Enable Account
                  </DropdownMenuItem>
                ) : !isAdmin ? (
                  <DropdownMenuItem
                    onClick={() =>
                      onDisable(user.id, user.name || "User", user.email)
                    }
                    className="cursor-pointer hover:bg-orange-500/10 hover:text-orange-600 focus:bg-orange-500/10 focus:text-orange-600 transition-colors dark:hover:text-orange-400 dark:focus:text-orange-400"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Disable Account
                  </DropdownMenuItem>
                ) : null}

                {/* Delete account (only for non-admin users) */}
                {!isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        onDelete(user.id, user.name || "User", user.email)
                      }
                      className="cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
