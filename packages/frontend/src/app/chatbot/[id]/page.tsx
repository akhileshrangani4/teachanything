'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatbots, files, analytics, embed } from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  CogIcon, 
  DocumentIcon, 
  ChartBarIcon, 
  ChatBubbleLeftRightIcon,
  ArrowLeftIcon,
  TrashIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import { ChatWidget } from '@/components/ChatWidget';
import { FileUploadModal } from '@/components/FileUploadModal';
import { AnalyticsChart } from '@/components/AnalyticsChart';
import Link from 'next/link';

export default function ChatbotDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('settings');
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
  const [embedCode, setEmbedCode] = useState('');
  const queryClient = useQueryClient();

  // Fetch chatbot details
  const { data: chatbot, isLoading } = useQuery({
    queryKey: ['chatbot', params.id],
    queryFn: async () => {
      const response = await chatbots.get(params.id);
      return response.data;
    },
  });

  // Fetch files
  const { data: fileList } = useQuery({
    queryKey: ['files', params.id],
    queryFn: async () => {
      const response = await files.list(params.id);
      return response.data;
    },
  });

  // Fetch analytics
  const { data: analyticsData } = useQuery({
    queryKey: ['analytics', params.id],
    queryFn: async () => {
      const response = await analytics.getChatbotAnalytics(params.id);
      return response.data;
    },
  });

  // Update chatbot mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => chatbots.update(params.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot', params.id] });
      toast.success('Chatbot updated successfully');
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => files.delete(params.id, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', params.id] });
      toast.success('File deleted successfully');
    },
  });

  // Get embed code
  const getEmbedCode = async (type: 'iframe' | 'script') => {
    try {
      const response = await embed.getCode(params.id, type);
      setEmbedCode(response.data.embedCode);
      toast.success('Embed code generated');
    } catch (error) {
      toast.error('Failed to generate embed code');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'settings', name: 'Settings', icon: CogIcon },
    { id: 'files', name: 'Files', icon: DocumentIcon },
    { id: 'analytics', name: 'Analytics', icon: ChartBarIcon },
    { id: 'test', name: 'Test Chat', icon: ChatBubbleLeftRightIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{chatbot?.name}</h1>
          <p className="mt-2 text-gray-600">{chatbot?.description}</p>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                      ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className={`mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'}`} />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    updateMutation.mutate({
                      name: formData.get('name'),
                      description: formData.get('description'),
                      systemPrompt: formData.get('systemPrompt'),
                      model: formData.get('model'),
                      temperature: parseInt(formData.get('temperature') as string),
                      maxTokens: parseInt(formData.get('maxTokens') as string),
                      welcomeMessage: formData.get('welcomeMessage'),
                      isPublic: formData.get('isPublic') === 'on',
                    });
                  }}
                >
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <input
                        name="name"
                        defaultValue={chatbot?.name}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        name="description"
                        defaultValue={chatbot?.description}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">System Prompt</label>
                      <textarea
                        name="systemPrompt"
                        defaultValue={chatbot?.system_prompt}
                        rows={5}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Model</label>
                        <select
                          name="model"
                          defaultValue={chatbot?.model}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value="gpt-4o-mini">GPT-4 Mini</option>
                          <option value="gpt-4o">GPT-4</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                          <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Temperature</label>
                        <input
                          type="number"
                          name="temperature"
                          defaultValue={chatbot?.temperature}
                          min={0}
                          max={100}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Welcome Message</label>
                      <input
                        name="welcomeMessage"
                        defaultValue={chatbot?.welcome_message}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => getEmbedCode('iframe')}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Get Embed Code
                    </button>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>

                {embedCode && (
                  <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Embed Code</h3>
                    <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                      <code>{embedCode}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Files Tab */}
            {activeTab === 'files' && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Context Files</h3>
                  <button
                    onClick={() => setIsFileUploadOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                    Upload File
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {fileList?.map((file: any) => (
                    <div key={file.id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <DocumentIcon className="h-8 w-8 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {file.fileType} • {(file.fileSize / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this file?')) {
                            deleteFileMutation.mutate(file.id);
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}

                  {fileList?.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No files uploaded yet. Add context files to help your chatbot provide better responses.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Conversations</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analyticsData?.metrics?.totalConversations || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Messages</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analyticsData?.metrics?.totalMessages || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Unique Sessions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analyticsData?.metrics?.uniqueSessions || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Avg Messages/Conv</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analyticsData?.metrics?.avgMessagesPerConversation?.toFixed(1) || 0}
                    </p>
                  </div>
                </div>

                <AnalyticsChart chatbotId={params.id} />
              </div>
            )}

            {/* Test Chat Tab */}
            {activeTab === 'test' && (
              <div className="max-w-2xl mx-auto">
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-900">
                    Test your chatbot here. This is how it will appear to your users.
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: '500px' }}>
                  <ChatWidget
                    chatbotId={params.id}
                    config={chatbot}
                    embedded={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <FileUploadModal
        isOpen={isFileUploadOpen}
        onClose={() => setIsFileUploadOpen(false)}
        chatbotId={params.id}
      />
    </div>
  );
}
