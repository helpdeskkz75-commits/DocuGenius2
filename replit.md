# DocuGenius

## Overview

DocuGenius is a full-stack AI-powered bot management system designed for handling customer interactions across multiple channels (Telegram and WhatsApp). The system features a React-based dashboard for monitoring conversations, managing leads, tracking products, and analyzing bot performance. Built with Node.js/Express backend, TypeScript throughout, and PostgreSQL database with Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite with custom configuration for development and production

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript with ES modules
- **API Structure**: RESTful endpoints under `/api` prefix
- **Database Access**: Drizzle ORM with PostgreSQL dialect
- **Session Management**: Express sessions with PostgreSQL storage
- **Bot Integration**: node-telegram-bot-api for Telegram interactions

### Database Design
- **ORM**: Drizzle with PostgreSQL
- **Schema**: Five main tables - users, conversations, leads, products, bot_commands, system_status
- **Relationships**: Foreign key relationships between conversations and users, leads tracking across channels
- **Migration**: Drizzle Kit for schema migrations

### AI and Bot Features
- **Multi-channel Support**: Telegram and WhatsApp integration
- **Language Detection**: Automatic Kazakh/Russian language detection
- **Conversational Funnel**: 3-step lead qualification process
- **Product Search**: Integration with Google Sheets for product catalog
- **Lead Management**: Automated lead capture and tracking
- **QR Code Generation**: Payment QR code generation capability

### Authentication and Authorization
- **Session-based Authentication**: Express sessions with PostgreSQL storage
- **User Management**: Basic user creation and authentication
- **Dashboard Access**: Protected routes requiring authentication

## External Dependencies

### Third-party Services
- **Google Sheets API**: Product catalog management and lead storage via googleapis
- **Telegram Bot API**: Bot interactions through node-telegram-bot-api
- **WhatsApp Integration**: 360dialog API for WhatsApp messaging
- **Neon Database**: PostgreSQL hosting via @neondatabase/serverless

### Key Libraries
- **UI Framework**: React with @radix-ui components
- **State Management**: @tanstack/react-query for API state
- **Database**: drizzle-orm with PostgreSQL driver
- **Styling**: Tailwind CSS with class-variance-authority
- **Development**: Vite with TypeScript support
- **QR Generation**: qrcode library for payment codes
- **Date Handling**: date-fns for date formatting

### Environment Configuration
- Database connection via DATABASE_URL
- Telegram bot token and operator group configuration
- Google Sheets API credentials and sheet IDs
- WhatsApp API configuration for 360dialog provider