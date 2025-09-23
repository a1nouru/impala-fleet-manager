# Royal Express Fleet Manager
## Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** September 16, 2025  
**Product:** Royal Express Fleet Manager - Comprehensive Fleet Operations & Financial Management System  

---

## 1. Executive Summary

Royal Express Fleet Manager is a comprehensive web-based management system designed for fleet transportation companies operating in Angola. The system provides end-to-end management of daily operations, financial tracking, human resources, maintenance scheduling, vehicle rentals, and automated notifications through WhatsApp integration.

### Key Value Propositions
- **Operational Efficiency**: Streamlined daily report generation and financial tracking
- **Financial Transparency**: Real-time revenue, expense, and profitability analysis with audit capabilities
- **Automated Compliance**: Built-in bank verification and deposit reconciliation for Angolan banks (Caixa Angola, BAI)
- **Integrated HR Management**: Employee payroll with automated damage deduction calculations
- **Proactive Maintenance**: Scheduled maintenance tracking with parts inventory management
- **Real-time Communication**: WhatsApp-based notification system for critical business alerts

### Target Market
Small to medium-sized transportation companies in Angola operating passenger transport services with 5-50 vehicles, requiring comprehensive operational and financial management.

---

## 2. System Overview & Core Features

### 2.1 Financial Management Module

**Daily Operations Reporting**
- **Vehicle Daily Reports**: Comprehensive daily report system for each vehicle including operational status, route information, and revenue tracking
- **Revenue Breakdown**: Separate tracking for ticket revenue, baggage revenue, and cargo revenue
- **Expense Management**: Categorized expense tracking (fuel, repairs, driver payments, etc.) with receipt upload functionality
- **Route Optimization**: Common route templates for Luanda-Mbanza, Luanda-Huambo, and other major corridors

**Banking & Deposits**
- **Multi-Bank Support**: Integration with Caixa Angola and BAI banking systems
- **Deposit Reconciliation**: Link daily reports to bank deposits with automated verification
- **Multiple Slip Upload**: Support for multiple bank slip documents per deposit
- **Bank Verification API**: Automated verification of deposit authenticity through bank APIs

**Financial Analytics**
- **Real-time Dashboards**: KPI metrics including profit margins, revenue growth, and vehicle performance
- **Audit System**: Date-based auditing with role-based access (restricted to authorized personnel)
- **Company Expenses**: Separate tracking for non-operational company expenses with receipt management
- **Financial Reports**: Automated generation of financial summaries, trend analysis, and comparative reports

### 2.2 Human Resources Module

**Employee Management**
- **Employee Database**: Comprehensive employee records with IBAN/NIB for salary transfers
- **Salary Management**: Monthly salary tracking with Angolan Kwanza (AKZ) currency support
- **Payroll Processing**: Automated payroll generation with damage deduction calculations

**Vehicle Damage Tracking**
- **Damage Recording**: Detailed damage reports linking employees to specific vehicles
- **Financial Impact**: Cost tracking with automated monthly deduction calculations (maximum 30% of salary)
- **Payment Tracking**: Balance tracking until damage costs are fully recovered
- **Document Management**: Upload and store damage-related documentation

### 2.3 Vehicle & Maintenance Module

**Fleet Management**
- **Vehicle Registry**: Complete vehicle database with plate numbers and model information
- **Maintenance Scheduling**: Preventive and corrective maintenance tracking
- **Parts Inventory**: Comprehensive parts catalog with cost tracking
- **Technician Management**: Service provider database with contact information
- **Maintenance History**: Complete service history for each vehicle

**Rental Operations**
- **Vehicle Rental Management**: Track vehicles rented to external clients
- **Availability System**: Real-time vehicle availability for rental periods
- **Rental Revenue Tracking**: Separate revenue stream from daily operations
- **Client Management**: Customer database for rental clients
- **Rental Expenses**: Track costs associated with rental operations

### 2.4 Notifications & Communication

**WhatsApp Integration**
- **Automated Alerts**: Scheduled notifications for critical business events
- **Threshold Notifications**: Alerts when financial thresholds are exceeded
- **Maintenance Reminders**: Automated maintenance due date notifications
- **Custom Message Templates**: Configurable message templates with dynamic variables
- **Multi-Group Support**: Different notification groups for different alert types

**Alert Management**
- **Business Rule Engine**: Configurable alerts based on revenue, expenses, or operational metrics
- **Escalation System**: Multi-level notification system for critical issues
- **Audit Trail**: Complete log of all notifications sent with delivery status

---

## 3. Technical Architecture & Implementation

### 3.1 Technology Stack

**Frontend**
- **Framework**: Next.js 15.3.1 with React 19
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: React Context API for authentication and global state
- **Internationalization**: Multi-language support (Portuguese/English) with i18next
- **Animations**: Framer Motion for enhanced user experience

**Backend & Database**
- **Database**: PostgreSQL with Supabase as Backend-as-a-Service
- **Authentication**: Supabase Auth with Row Level Security (RLS)
- **File Storage**: Supabase Storage for document and receipt management
- **API Integration**: WhatsApp Business API and Angolan bank verification APIs

**Infrastructure**
- **Deployment**: Railway for production deployment
- **File Storage**: Organized storage buckets for different document types
- **Security**: Row-level security policies for multi-tenant data isolation

### 3.2 Data Architecture

**Core Entities**
- **Vehicles**: Fleet registry with operational status tracking
- **Daily Reports**: Operational and financial data for each vehicle per day
- **Employees**: HR records with payroll and damage tracking
- **Bank Deposits**: Financial transaction records with multi-slip support
- **Maintenance Records**: Service history and parts usage
- **Notifications**: Alert definitions and delivery logs

**Data Relationships**
- Many-to-many relationship between bank deposits and daily reports
- One-to-many relationships for vehicle maintenance records
- Complex payroll calculations with damage deduction algorithms
- Audit trail tables for financial transparency

### 3.3 Security & Compliance

**Data Security**
- Row Level Security (RLS) policies for all sensitive data
- Role-based access control for audit functions
- Secure file upload and storage with access controls
- Encrypted storage for sensitive financial information

**Financial Compliance**
- Audit-ready financial records with timestamp tracking
- Bank reconciliation capabilities for regulatory compliance
- Receipt and documentation requirements for tax purposes
- Financial report generation for accounting standards

### 3.4 Integration Capabilities

**Banking Integration**
- API connections to Caixa Angola and BAI for deposit verification
- Automated bank statement reconciliation
- Multi-currency support with AOA as primary currency

**Communication Integration**
- WhatsApp Business API for automated notifications
- Email notifications as backup communication channel
- SMS integration capability for critical alerts

**Third-party Services**
- Google Cloud APIs for additional services
- Potential integration with accounting software
- Export capabilities for external financial systems

---

## 4. User Experience & Interface Design

### 4.1 Dashboard Design
- **Modern UI**: Clean, responsive design optimized for desktop and mobile
- **Real-time Updates**: Live data updates without page refresh
- **Intuitive Navigation**: Clear sidebar navigation with role-based menu items
- **Visual Analytics**: Charts and graphs for financial performance tracking

### 4.2 User Roles & Permissions
- **Fleet Manager**: Full system access with audit capabilities
- **Operations Staff**: Daily report entry and basic financial viewing
- **HR Manager**: Employee and payroll management access
- **Maintenance Staff**: Vehicle maintenance and parts management
- **Auditor**: Read-only access to financial data and audit functions

### 4.3 Mobile Responsiveness
- Fully responsive design for tablet and mobile access
- Touch-optimized interface for field operations
- Offline capability for critical functions
- Progressive Web App (PWA) features for mobile installation

---

## 5. Implementation Roadmap & Future Enhancements

### 5.1 Current System Status
✅ **Implemented Features**
- Complete financial management with daily reporting
- HR management with payroll and damage tracking
- Vehicle maintenance scheduling
- WhatsApp notification system
- Bank deposit reconciliation
- Audit system with role-based access

### 5.2 Future Enhancements
**Phase 1 (Q1 2026)**
- Mobile application for Android/iOS
- Advanced reporting with AI-powered insights
- Integration with fuel card systems
- GPS tracking integration for real-time vehicle monitoring

**Phase 2 (Q2 2026)**
- Customer portal for rental clients
- Advanced predictive maintenance using ML
- Integration with government transport authorities
- Multi-company support for franchise operations

**Phase 3 (Q3 2026)**
- IoT device integration for vehicle diagnostics
- Advanced analytics with business intelligence dashboards
- API marketplace for third-party integrations
- Blockchain-based audit trails for enhanced transparency

### 5.3 Success Metrics
- **Operational Efficiency**: 50% reduction in daily report processing time
- **Financial Accuracy**: 99.9% accuracy in bank reconciliation
- **User Adoption**: 95% daily active usage among fleet operations staff
- **Cost Savings**: 20% reduction in administrative overhead
- **Compliance**: 100% audit readiness with complete financial trail

---

## 6. Conclusion

Royal Express Fleet Manager represents a comprehensive solution for modern fleet operations in Angola, combining operational efficiency with financial transparency. The system's modular architecture and robust feature set position it as a scalable solution for growing transportation businesses.

The integration of modern web technologies with local banking systems and communication channels makes it uniquely suited for the Angolan market while maintaining international standards for data security and financial compliance.

**Next Steps:**
1. Review and approve PRD with stakeholders
2. Finalize deployment and production readiness
3. Conduct user training and system rollout
4. Begin Phase 1 enhancement development
5. Establish ongoing support and maintenance procedures

