"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatbots } from "@/lib/api";
import {
  PlusIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ShareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import toast from "react-hot-toast";
import { CreateChatbotModal } from "@/components/CreateChatbotModal";
import { ShareModal } from "@/components/ShareModal";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Disable static generation for this page
export const dynamic = "force-dynamic";

export default function Dashboard() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [shareModalData, setShareModalData] = useState<any>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  useSession({
    required: true,
    onUnauthenticated() {
      router.push("/login");
    },
  });

  const { data: chatbotList, isLoading } = useQuery({
    queryKey: ["chatbots"],
    queryFn: async () => {
      const response = await chatbots.list();
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: chatbots.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbots"] });
      toast.success("Chatbot deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete chatbot");
    },
  });

  const shareMutation = useMutation({
    mutationFn: chatbots.generateShareLink,
    onSuccess: (response, chatbotId) => {
      const chatbot = chatbotList?.find((c: any) => c.id === chatbotId);
      setShareModalData({
        ...chatbot,
        ...response.data,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Chatbots</h1>
          <p className="mt-2 text-gray-600">
            Create and manage AI chatbots for your website
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <ChatBubbleLeftRightIcon className="h-10 w-10 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Chatbots
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {chatbotList?.length || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <ChartBarIcon className="h-10 w-10 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Conversations
                </p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <ShareIcon className="h-10 w-10 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Active Shares
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {chatbotList?.filter((c: any) => c.share_token).length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Create Button */}
        <div className="mb-6">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create New Chatbot
          </button>
        </div>

        {/* Chatbots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chatbotList?.map((chatbot: any) => (
            <div
              key={chatbot.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {chatbot.name}
                </h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {chatbot.description || "No description provided"}
                </p>

                <div className="flex items-center text-xs text-gray-500 mb-4">
                  <span className="px-2 py-1 bg-gray-100 rounded-full">
                    {chatbot.model}
                  </span>
                </div>

                <div className="flex space-x-2">
                  <Link
                    href={`/chatbot/${chatbot.id}`}
                    className="flex-1 text-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Manage
                  </Link>
                  <button
                    onClick={() => shareMutation.mutate(chatbot.id)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <ShareIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm("Are you sure you want to delete this chatbot?")
                      ) {
                        deleteMutation.mutate(chatbot.id);
                      }
                    }}
                    className="px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {chatbotList?.length === 0 && (
          <div className="text-center py-12">
            <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No chatbots
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new chatbot.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create New Chatbot
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateChatbotModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
      {shareModalData && (
        <ShareModal
          isOpen={!!shareModalData}
          onClose={() => setShareModalData(null)}
          chatbot={shareModalData}
        />
      )}
    </div>
  );
}
