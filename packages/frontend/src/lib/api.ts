import axios from "axios";
import { getSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const session = await getSession();

  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // NextAuth will handle redirect to login
      window.location.href = "/api/auth/signin";
    }
    return Promise.reject(error);
  },
);

export default api;

// Auth APIs
export const auth = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (email: string, password: string, name?: string) =>
    api.post("/auth/register", { email, password, name }),
  me: () => api.get("/auth/me"),
  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post("/auth/reset-password", { token, newPassword }),
};

// Chatbot APIs
export const chatbots = {
  list: () => api.get("/chatbots"),
  get: (id: string) => api.get(`/chatbots/${id}`),
  create: (data: any) => api.post("/chatbots", data),
  update: (id: string, data: any) => api.put(`/chatbots/${id}`, data),
  delete: (id: string) => api.delete(`/chatbots/${id}`),
  generateShareLink: (id: string) => api.post(`/chatbots/${id}/share`),
};

// Chat APIs
export const chat = {
  sendMessage: (chatbotId: string, message: string, sessionId?: string) =>
    api.post(`/chat/${chatbotId}/message`, { message, sessionId }),
  sendSharedMessage: (
    shareToken: string,
    message: string,
    sessionId?: string,
  ) => api.post(`/chat/shared/${shareToken}/message`, { message, sessionId }),
  getHistory: (chatbotId: string, sessionId: string) =>
    api.get(`/chat/${chatbotId}/history/${sessionId}`),
};

// File APIs
export const files = {
  upload: (chatbotId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/files/${chatbotId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  uploadText: (chatbotId: string, data: any) =>
    api.post(`/files/${chatbotId}/upload-text`, data),
  list: (chatbotId: string) => api.get(`/files/${chatbotId}`),
  delete: (chatbotId: string, fileId: string) =>
    api.delete(`/files/${chatbotId}/${fileId}`),
  getContent: (chatbotId: string, fileId: string) =>
    api.get(`/files/${chatbotId}/${fileId}/content`),
};

// Embed APIs
export const embed = {
  getCode: (chatbotId: string, type: "iframe" | "script" = "iframe") =>
    api.get(`/embed/${chatbotId}/code`, { params: { type } }),
};

// Analytics APIs
export const analytics = {
  getChatbotAnalytics: (chatbotId: string, timeRange: string = "7d") =>
    api.get(`/analytics/chatbot/${chatbotId}`, { params: { timeRange } }),
  getOverview: (timeRange: string = "7d") =>
    api.get("/analytics/overview", { params: { timeRange } }),
  getConversations: (chatbotId: string, options?: any) =>
    api.get(`/analytics/conversations/${chatbotId}`, { params: options }),
  getMessageVolume: (chatbotId: string, interval: string = "day") =>
    api.get(`/analytics/messages/${chatbotId}`, { params: { interval } }),
  getTopics: (chatbotId: string) => api.get(`/analytics/topics/${chatbotId}`),
  trackEvent: (data: any) => api.post("/analytics/event", data),
};
