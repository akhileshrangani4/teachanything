"use client";

import { Fragment, useCallback } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useDropzone } from "react-dropzone";
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { files } from "@/lib/api";
import toast from "react-hot-toast";

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatbotId: string;
}

export function FileUploadModal({
  isOpen,
  onClose,
  chatbotId,
}: FileUploadModalProps) {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => files.upload(chatbotId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", chatbotId] });
      toast.success("File uploaded successfully");
      onClose();
    },
    onError: () => {
      toast.error("Failed to upload file");
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        uploadMutation.mutate(acceptedFiles[0]);
      }
    },
    [uploadMutation],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "text/csv": [".csv"],
      "application/json": [".json"],
      "application/pdf": [".pdf"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  });

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  Upload Context File
                </Dialog.Title>

                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
                    ${uploadMutation.isPending ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  <input
                    {...getInputProps()}
                    disabled={uploadMutation.isPending}
                  />

                  <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />

                  {isDragActive ? (
                    <p className="text-sm text-gray-600">
                      Drop the file here...
                    </p>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        Drag and drop a file here, or click to select
                      </p>
                      <p className="text-xs text-gray-500">
                        Supported: TXT, MD, CSV, JSON, PDF (max 10MB)
                      </p>
                    </div>
                  )}
                </div>

                {uploadMutation.isPending && (
                  <div className="mt-4">
                    <div className="bg-gray-100 rounded-lg p-3 flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                      <span className="text-sm text-gray-700">
                        Uploading file...
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    disabled={uploadMutation.isPending}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
