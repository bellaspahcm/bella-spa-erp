# ERP Maintenance & Optimization Log

## 2026-05-16: Financial & UI Stability Update

### 1. Database Function Fix: `get_financial_anomalies`
- **Issue**: The "Đối soát tài chính" page was crashing because it referenced a non-existent `full_name` column in the `customers` table.
- **Root Cause**: A legacy database function was joining `bookings` with `customers` and selecting `c.full_name`, but the schema had been migrated to use `name_mother` and `name_baby`.
- **Solution**: 
    - Updated the RPC function to use `COALESCE(c.name_mother, c.name_baby, 'Khách hàng')`.
    - Removed reference to `revenue_date` (which was also missing, replaced by `received_date`).
    - Added `SET search_path = 'public'` for security best practices.

### 2. UI Optimization: Sidebar Footer Pinning
- **Issue**: The "Admin" profile and "Logout" buttons were part of the vertical flow and could be cut off on smaller screens or long menus, requiring scrolling to access logout.
- **Solution**:
    - Refactored `src/components/layout/sidebar.tsx`.
    - Applied `mt-auto` to the footer container to force it to the bottom of the flex column.
    - Used `sticky bottom-0` behavior by ensuring the parent `aside` is `h-screen` and the middle `nav` is `flex-1 overflow-y-auto`.
    - Added `backdrop-blur-md` and `bg-white/60` to create a visual "dock" at the bottom.
    - Reduced padding to minimize the gap between the logout button and the taskbar.

### 3. Data Hygiene: "TEST" Data Cleanup
- **Issue**: System was cluttered with "TEST" entries (customers, bookings, sessions) that skewed financial reports.
- **Action**: 
    - Executed a cascading cleanup script to remove all customers with "TEST" in their name.
    - Deleted related records in `bookings`, `session_logs`, `revenue`, `shifts`, `attendance`, `inventory_logs`, `session_reviews`, `chat_messages`, and `membership_records`.
    - Verified 0 records remaining for test entities.
