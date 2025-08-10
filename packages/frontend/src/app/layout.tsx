import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { getServerSession } from 'next-auth';
import { PropsWithChildren } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AIAlexa - AI Chatbot Manager',
  description: 'Create and manage AI chatbots for your website',
};

export default async function RootLayout({
  children,
}: PropsWithChildren) {
  const session = await getServerSession();
  
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
