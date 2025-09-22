"use client";

import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatbots } from "@/lib/api";
import toast from "react-hot-toast";

interface CreateChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateChatbotModal({
  isOpen,
  onClose,
}: CreateChatbotModalProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const createMutation = useMutation({
    mutationFn: chatbots.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbots"] });
      toast.success("Chatbot created successfully");
      reset();
      onClose();
    },
    onError: () => {
      toast.error("Failed to create chatbot");
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate({
      ...data,
      temperature: parseInt(data.temperature),
      maxTokens: parseInt(data.maxTokens),
      suggestedQuestions: data.suggestedQuestions
        ? data.suggestedQuestions.split("\n").filter(Boolean)
        : [],
    });
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                >
                  Create New Chatbot
                </Dialog.Title>

                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="mt-4 space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      {...register("name", { required: "Name is required" })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.name.message as string}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      {...register("description")}
                      rows={2}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      System Prompt
                    </label>
                    <textarea
                      {...register("systemPrompt", {
                        required: "System prompt is required",
                      })}
                      rows={4}
                      placeholder="You are a helpful assistant..."
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    {errors.systemPrompt && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.systemPrompt.message as string}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Model
                      </label>
                      <select
                        {...register("model")}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="gpt-4o-mini">GPT-4 Mini</option>
                        <option value="gpt-4o">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="claude-3-haiku">Claude 3 Haiku</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Temperature (0-100)
                      </label>
                      <input
                        type="number"
                        {...register("temperature")}
                        defaultValue={70}
                        min={0}
                        max={100}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      {...register("maxTokens")}
                      defaultValue={2000}
                      min={100}
                      max={4000}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Welcome Message
                    </label>
                    <input
                      {...register("welcomeMessage")}
                      placeholder="Hello! How can I help you today?"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Suggested Questions (one per line)
                    </label>
                    <textarea
                      {...register("suggestedQuestions")}
                      rows={3}
                      placeholder="What services do you offer?&#10;How can I get started?&#10;What are your pricing plans?"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {createMutation.isPending
                        ? "Creating..."
                        : "Create Chatbot"}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
