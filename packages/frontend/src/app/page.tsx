import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold text-gray-900 mb-4">
            AI Chatbot Manager
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Create, customize, and deploy intelligent chatbots for your website
            in minutes
          </p>

          <div className="flex justify-center space-x-4">
            <Link
              href="/register"
              className="px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">
              🤖 Multiple AI Models
            </h3>
            <p className="text-gray-600">
              Choose from OpenAI, Anthropic, or 100+ models via OpenRouter
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">📁 Context Files</h3>
            <p className="text-gray-600">
              Upload documents to give your chatbot specialized knowledge
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">📊 Analytics</h3>
            <p className="text-gray-600">
              Track conversations, popular topics, and usage patterns
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
