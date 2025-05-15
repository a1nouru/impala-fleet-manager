# Royal Express Fleet Management System

A comprehensive web application for managing a fleet of 9 Kinglong buses for Royal Express, a public transportation business in Angola. The system helps track vehicle maintenance, manage spare parts inventory, and monitor repair costs.

## Project Structure

```
royalexpress-fleet-manager/
├── frontend/          # React.js frontend
│   ├── app/           # Next.js app router
│   ├── components/    # UI components
│   ├── lib/           # Utility functions
│   └── public/        # Static assets
```

## Features

- **Vehicle Management**: Track all vehicles, their operational status, and complete maintenance history
- **Inventory Management**: Manage spare parts inventory, track stock levels, and get low stock alerts
- **Maintenance Records**: Log all repairs and maintenance with associated parts and costs
- **Cost Analysis**: Monthly and year-over-year cost analysis for each vehicle and the entire fleet
- **Mechanic Tracking**: Record mechanic information for each maintenance event
- **Mileage Tracking**: Update mileage during oil changes

## Frontend Technologies

- **Next.js**: React framework for server-rendered applications
- **React**: Frontend library for building user interfaces
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library built on Radix UI and Tailwind CSS
- **Framer Motion**: Animation library for React

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/royalexpress-fleet-manager.git
   cd royalexpress-fleet-manager
   ```

2. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Development Roadmap

1. **Phase 1**: Basic vehicle and maintenance tracking
   - Vehicle registration
   - Maintenance logging
   - Basic reporting

2. **Phase 2**: Inventory management
   - Parts tracking
   - Stock level monitoring
   - Inventory valuation

3. **Phase 3**: Advanced analytics
   - Monthly cost analysis
   - Year-over-year comparisons
   - Predictive maintenance

## License

This project is proprietary and confidential. Unauthorized copying or distribution is prohibited.

© 2024 Royal Express. All rights reserved. 