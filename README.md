# AIAlexa - AI Chatbot Management Platform

🤖 **AIAlexa** is a comprehensive chatbot management system that allows you to create, customize, and deploy intelligent AI chatbots for your website. With support for multiple AI providers, file-based context (RAG), and easy embedding options.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-%5E5.3.3-blue.svg)

## Features

### Core Features
- **Multi-Provider AI Support**: OpenAI, Anthropic, and 100+ models via OpenRouter
- **RAG (Retrieval-Augmented Generation)**: Upload documents for contextual responses
- **Multiple Deployment Options**: Embed as iframe, JavaScript widget, or shareable link
- **Real-time Analytics**: Track conversations, popular topics, and usage patterns
- **File Processing**: Support for PDF, Word, Markdown, JSON, CSV, and plain text files
- **Semantic Search**: AI-powered search through uploaded documents
- **User Authentication**: Secure JWT-based authentication
- **Multi-Chatbot Management**: Create and manage multiple chatbots per account
- **Customizable Appearance**: Theme, colors, position, and welcome messages
- **Public Sharing**: Generate shareable links for public access
- **Conversation History**: Persistent chat sessions with full history

## Tech Stack

### Backend
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Vector DB**: pgvector for semantic search
- **AI SDK**: Vercel AI SDK
- **Authentication**: JWT with bcrypt

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Headless UI, Heroicons
- **Charts**: Recharts
- **Forms**: React Hook Form

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL with pgvector extension
- API keys for AI providers (OpenAI/Anthropic/OpenRouter)

## Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/aialexa.git
cd aialexa
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create `.env` files in the backend directory:

```bash
# backend/.env
DATABASE_URL=postgresql://username:password@localhost:5432/aialexa_db
JWT_SECRET=your-secret-key-change-this-in-production

# AI API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...

# URLs
FRONTEND_URL=http://localhost:3001
API_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000

NODE_ENV=development
PORT=3000
```

Create `.env.local` in the frontend directory:

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

4. **Set up the database**

Enable pgvector extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Run migrations:
```bash
npm run generate
npm run migrate
```

## Development

**Run both frontend and backend:**
```bash
npm run dev
```

**Run services individually:**
```bash
npm run dev:backend  # Backend on http://localhost:3000
npm run dev:frontend # Frontend on http://localhost:3001
```

**Database management:**
```bash
npm run generate  # Generate migrations
npm run migrate   # Apply migrations
npm run studio    # Open Drizzle Studio
```

## Project Structure

```
aialexa/
├── backend/
│ ├── src/
│ │ ├── api/ # API routes and server
│ │ │ ├── routes/ # Express routes
│ │ │ ├── services/ # Business logic
│ │ │ └── middleware/
│ │ ├── db/ # Database schema and connection
│ │ └── ai-client/ # AI provider integrations
│ ├── supabase/migrations/
│ └── package.json
├── frontend/
│ ├── src/
│ │ ├── app/ # Next.js app router pages
│ │ ├── components/ # React components
│ │ └── lib/ # Utilities and API client
│ └── package.json
└── package.json # Monorepo configuration
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Chatbots
- `GET /api/chatbots` - List user's chatbots
- `POST /api/chatbots` - Create chatbot
- `PUT /api/chatbots/:id` - Update chatbot
- `DELETE /api/chatbots/:id` - Delete chatbot
- `POST /api/chatbots/:id/share` - Generate share link

### Chat
- `POST /api/chat/:chatbotId/message` - Send message
- `POST /api/chat/shared/:shareToken/message` - Public chat
- `GET /api/chat/:chatbotId/history/:sessionId` - Get history

### Files
- `POST /api/files/:chatbotId/upload` - Upload file
- `GET /api/files/:chatbotId` - List files
- `DELETE /api/files/:chatbotId/:fileId` - Delete file

### Analytics
- `GET /api/analytics/chatbot/:id` - Chatbot analytics
- `GET /api/analytics/overview` - User overview
- `GET /api/analytics/messages/:id` - Message volume

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email akhileshrangani4@gmail.com or open an issue in this repository.

---

Built with ❤️ by Akhilesh Rangani
