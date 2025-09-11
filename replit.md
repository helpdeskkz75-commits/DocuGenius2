# DocuGenius

## Overview

DocuGenius is a full-stack AI-powered **multi-tenant** chatbot system supporting text/voice/image interactions via Telegram and WhatsApp, with ASR/TTS capabilities, Google Drive integration, and a pure dialog interface. The system features a React-based admin panel for multi-tenant management, conversation monitoring, lead tracking, and analytics. Built with Node.js/Express backend, TypeScript throughout, and PostgreSQL database with Drizzle ORM.

## Recent Changes

- **Multi-tenant architecture** implemented with complete data isolation
- **Admin panel** upgraded with tenant management (Create, Read, Update, Delete)
- **Tenant context switching** with persistent localStorage selection  
- **Pure dialog interface** - no buttons/keyboards, conversation-driven interaction
- **Voice & Image support** added for both Telegram and WhatsApp channels
- **Google Drive integration** for document storage and management
- **ASR/TTS services** for voice message processing
- **FSM-based dialog orchestrator** with 3-slot funnel (purpose/volume/budget → deadline/conditions)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **Multi-tenant Context**: Global tenant context with localStorage persistence
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite with custom configuration for development and production
- **Admin Features**: 
  - Tenant management page with full CRUD operations
  - Tenant selector in page headers for context switching
  - Data scoped by tenant ID in all API calls

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript with ES modules
- **API Structure**: RESTful endpoints under `/api` prefix
- **Database Access**: Drizzle ORM with PostgreSQL dialect
- **Session Management**: Express sessions with PostgreSQL storage
- **Bot Integration**: node-telegram-bot-api for Telegram interactions

### Database Design
- **ORM**: Drizzle with PostgreSQL
- **Multi-tenant Schema**: Eight core tables with tenant isolation via foreign keys
  - `tenants` - tenant configuration (tokens, settings, Google Drive folders)
  - `catalogs` - tenant-specific product catalogs with search optimization
  - `customers` - customer data per tenant with chat integration
  - `carts` & `cart_items` - shopping cart functionality
  - `orders` - order management with tenant scoping
  - `tenant_leads` - lead tracking with file attachments (tenant-scoped)
  - `texts` - customizable tenant-specific text content
- **Legacy Schema**: Base tables for system-wide data (users, conversations, leads, products, bot_commands, system_status)
- **Data Isolation**: All tenant data properly scoped with foreign key constraints
- **Migration**: Drizzle Kit with generated SQL migrations in `/migrations`

### AI and Bot Features
- **Multi-channel Support**: Telegram and WhatsApp integration with unified bot logic
- **Pure Dialog Interface**: No buttons/keyboards - conversation-driven interaction only
- **Voice & Image Processing**: 
  - ASR (Automatic Speech Recognition) with Kazakh/Russian language support
  - TTS (Text-to-Speech) for voice responses 
  - Image analysis and processing capabilities
- **OpenAI Integration**: GPT-powered conversational AI with industry-specific prompts
- **FSM Dialog Orchestrator**: Finite State Machine with 3-slot funnel system:
  - Slot 1: Purpose/Volume/Budget collection
  - Slot 2: Deadline/Conditions refinement  
  - Transition logic with AI fallback handling
- **Language Detection**: Automatic Kazakh/Russian language detection for text and audio
- **Multi-tenant Webhooks**: Separate webhook endpoints per tenant (`/webhook/tg/:tenantKey`, `/webhook/wa/:tenantKey`)
- **Industry Adaptation**: AI personality and responses tailored to 12+ business sectors
- **Smart Recommendations**: AI-powered product suggestions based on user queries
- **Context Memory**: Conversation history tracking for personalized interactions
- **Google Drive Integration**: Document storage and retrieval with tenant-specific folders
- **Lead Management**: Automated lead capture with file attachments and tenant isolation

### Authentication and Authorization
- **Session-based Authentication**: Express sessions with PostgreSQL storage
- **User Management**: Basic user creation and authentication
- **Dashboard Access**: Protected routes requiring authentication

## External Dependencies

### Third-party Services
- **OpenAI API**: GPT-4 and GPT-3.5 models for conversational AI and smart recommendations
- **Google Sheets API**: Product catalog management and lead storage via googleapis
- **Telegram Bot API**: Bot interactions through node-telegram-bot-api
- **WhatsApp Integration**: 360dialog API for WhatsApp messaging
- **Neon Database**: PostgreSQL hosting via @neondatabase/serverless

### Key Libraries
- **AI Integration**: OpenAI SDK for GPT model access and conversation management
- **UI Framework**: React with @radix-ui components
- **State Management**: @tanstack/react-query for API state
- **Database**: drizzle-orm with PostgreSQL driver
- **Styling**: Tailwind CSS with class-variance-authority
- **Development**: Vite with TypeScript support
- **QR Generation**: qrcode library for payment codes
- **Date Handling**: date-fns for date formatting

### Environment Configuration
- Database connection via DATABASE_URL
- OpenAI API key and model configuration for AI features
- Telegram bot token and operator group configuration  
- Google Sheets API credentials and sheet IDs
- WhatsApp API configuration for 360dialog provider
- AI personality and industry settings for contextual responses