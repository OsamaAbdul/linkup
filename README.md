# Linkup Marketplace

A premium, full-stack marketplace and logistics platform designed for high-performance e-commerce and delivery operations. Built with a modern tech stack and a focus on visual excellence.

## Key Features

### Marketplace Engine
- **Advanced Product Catalog**: Detailed product pages with premium animations and responsive layouts.
- **Seamless Checkout**: Integrated cart management and secure checkout flow.
- **Wishlist & Reach**: Social-ready product sharing and personal wishlists.

### Logistics & Operations
- **Real-time Tracking**: Interactive maps for live order tracking and logistics management.
- **Mission Center**: Dedicated logistics dashboard for dispatchers and delivery partners.
- **Intel Dashboard**: Advanced shipment intelligence and status monitoring.

### Growth & Engagement
- **Promoter Dashboard**: Centralized management for marketing and engagement attribution.
- **Affiliate Tracking**: Robust system for tracking and rewarding platform growth.
- **Smart Notifications**: Real-time updates for orders, messages, and platform events.

### Unified Authentication
- **Secure Onboarding**: Multi-step onboarding flow for different user roles (Buyer, Seller, Logistics).
- **Profile Management**: Comprehensive user and seller profile customization.

## Tech Stack

- **Frontend**: [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Data Fetching**: [TanStack Query v5](https://tanstack.com/query/latest)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Mapping**: [Leaflet](https://leafletjs.com/)
- **Backend**: [Supabase](https://supabase.com/) (Auth, Database, Storage, Edge Functions)
- **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or bun

### Local Development

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd linkup-marketplace
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory (refer to `.env.example` if available).

4. **Run the development server**
   ```bash
   npm run dev
   ```

## Project Structure

- `src/components`: UI components, organized by feature area (auth, products, logistics, etc.).
- `src/pages`: Main application views.
- `src/hooks`: Custom React hooks for global and local state.
- `src/contexts`: Application-level context providers (Auth, Cart, Theme).
- `supabase/`: Local development environment for Supabase functions and migrations.

## Deployment

The project is optimized for deployment on platforms like **Vercel** or **Netlify**, with seamless integration for Supabase backend services.

---

*Built for the next generation of e-commerce.*
