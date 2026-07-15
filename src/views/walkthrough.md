# Walkthrough - Excel Export and Dashboard Metric Refinements

I have successfully updated the Excel generation utilities, Dashboard KPI logic, global timeline helpers, assignment validation logic, and the dashboard layout/components to add the dynamic Happy Weekdays Quote widget, layout greeting, single-line format layout, Today's Workforce Insights grid, click-to-verify modal, unified search, detailed audit popups, calendar-week leave return bounds, audit log employee name details, working employees today metrics, and blinking conflict alerts.

## Changes Implemented

### 1. Planning Summary (Consolidated & Standalone Workbooks)
- Replaced the generic **Project Start Date** and **Project End Date** columns with employee-specific **Allocated Start Date** and **Allocated End Date** columns.
- The values are now populated dynamically with the employee's specific assignment dates (`a.travelStartDate` and `a.travelEndDate`).
- Removed the extra `Assigned Date` column completely to keep the summary page focused and neat.
- Corrected the date centering loop to focus on Project Code, Allocated Start Date, Allocated End Date, Leave Start Date, and Leave End Date.

### 2. Attendance Grid Header Visibility & Month Groupings
- Fixed the issue where text (the title and the month/year label) was not visible due to being centered over the entire timeline width (which goes off-screen to the right).
- **Removed Redundant Month Label Banner**: Removed the row 2 A2:K2 merged banner displaying the list of unique months (e.g. `Month: May 2026, June 2026`).
- **Merged Title Banner**: Vertically merged rows 1 and 2 for the frozen summary columns A to K (`A1:K2`) to house the main title block (`STAFF PLANNING ATTENDANCE MATRIX (Period: start to end)`) in a solid Navy Blue background (`#1E3A8A`).
- **Timeline Month Groupings**: Grouped the timeline dates by month inside Rows 1 and 2 starting at Column L (12). Contiguous dates under each month are horizontally merged, styled in a clean Royal Blue fill (`#2563EB`), and labeled with their respective Month & Year (e.g. "May 2026", "June 2026") to visually segment and differentiate the months clearly.
- Cleaned up unused helper variables (`lastColLetter`, `getColLetter`, `getColLetterLocal`) to fix compilation errors.

### 3. Leave Details Sheets
- Replaced the **Project ID** column with two distinct columns: **Project Name** and **Project Code**.
- Updated both the consolidated workbook's `Leave Details` tab and the standalone `Leave Details` sheets to dynamically look up the budget/project code.

### 4. Consolidated Planning Grid Layout Shift & Continuous Unmerged Department Rows
- Shifted the consolidated sheet columns to match the tabular layout in the provided screenshot:
  - **Column A**: Employee Name (A column is not required, so the original Column A is removed. The department banner text like `Accountant` and `Admin` is placed in Column A directly under the "Name" column header).
  - **Column B**: Designation.
  - **Column C**: Remarks (displays the Project Budget Code merged with any assignment remarks, e.g. `BC-2026` or `BC-2026 - Remarks` directly on the employee's row).
  - **Column D**: Timeline labels (`Date`, `Week`, `Days`).
  - **Column E onwards**: Timeline dates/cells.
- Merged the **BUDGET - Project Name** label across columns A and B, placing the actual project name in Column C on Row 1, and the budget code in Column C on Row 2.
- **Continuous Unmerged Department Color Fill**: The department banner rows (e.g., `Accountant` or `Admin`) are not merged across cells. However, all cells in the row—from the summary info columns (Columns A-D) straight through the timeline columns (Column E onwards)—are filled with the solid Navy Blue background (`#1E3A8A`) and bordered in Navy Blue, providing a solid colored banner row look without sacrificing column cell integrity.
- Frozen columns split is set at Column 4 (D) so columns A, B, C, D remain fixed on screen while scrolling the timeline starting at Column E.
- Updated all standby block lists in the consolidated sheet to follow the exact same column structure.

### 5. Green Date Color Refinement
- Updated the fill color for `Project Start` and `Project End` date headers in both standalone and consolidated planning grids to the Excel bright lime green (`#92D050`) as requested.

### 6. Label Renaming (Function -> Designation)
- Renamed all references of **Function** in Excel sheets (such as column headers in Master planning sheet, Standby blocks, and summary row comments) to **Designation** to ensure alignment with the software UI.
- Renamed property keys in the employee mock seed profile data from `function` to `designation` inside `src/hooks/usePlanningState.ts`.

### 7. Leave Project on Dashboard
- Fixed the logic for displaying the assigned project for employees on leave on the dashboard.
- It now correctly maps and displays the project name (`projectId`) specified directly on the employee's `LeaveRecord` for today's active leave list and custom date range period analysis, instead of resolving it based on active assignments for `todayStr`.

### 8. Available Staff Split-Range Row Layout
- Updated both the Available Staff UI table and the Excel export report (`Availability Report` sheet) to display each separate contiguous availability period on its own row.
- If an employee is available in multiple periods, they are now presented as separate, sequential rows (below one another).
- The `Total Standby Days` column displays the specific standby days duration of *only* that row's availability range.

### 9. Dashboard Active Projects & On Leave Today Corrected
- **Timezone-Immune Date Resolution**: Changed `resolveStatusOnDate` and dashboard queries to compare normalized `YYYY-MM-DD` strings instead of native Javascript `Date` objects. This avoids timezone hour/offset shifts (e.g., UTC vs local midnight) that were causing date checks to fail or shift depending on the client location.
- **Active Projects Filtered by Duration**: Corrected the `Active Projects` count card on the dashboard. Instead of showing the count of all projects ever assigned in the database, it now counts only projects whose project start and end dates duration cover today's date.

### 10. Card Navigation to Master Sheet > Employees Database
- Updated the `On Leave Today` card click handler in the Dashboard view. It now redirects the user directly to the **Employees Database** tab of the **Master Sheet** rather than the allocations list, automatically filtering for employees on leave.

### 11. Overlapping Allocation Validation Rule
- **Form Overlap Prevention**: Added validation checks inside the manual Project Allocation submission form. If a user attempts to add or edit an allocation for an employee that overlaps with the dates of an existing allocation for that same employee, the application blocks the submission and prompts the user with an alert: `❌ Error: This employee already has a project allocation during these dates. Overlapping allocations are not allowed.`

### 12. Date Range Filter and Excel Export in Leave Management
- **Date Range Filters**: Added custom From Date and To Date filters to the Leave Management view. The list displays only leaves that overlap with the selected range.
- **Standalone Excel Export**: Integrated a new `Export Excel` button in the Leave Management control panel that generates a custom Excel report (`Leave_Report_start_to_end.xlsx`).
- **All Required Columns**: The exported Excel sheet includes all necessary columns: `Employee ID`, `Employee Name`, `Department`, `Designation`, `Project Name`, `Project ID` (mapped to project budget/project code), `Leave Start Date`, `Leave End Date`, and `Remarks`.

### 13. Availability Finder Split Working and Leave Columns
- **Dedicated Columns**: Replaced the combined `Allocation Details / Status` column in both the UI table and the exported Excel spreadsheet with two distinct, detailed columns: `Working Details` and `Leave Details`.
- **Project IDs and Dates Included**:
  - `Working Details` displays all active project assignments for that employee during the custom date range, including the Project Name, Project ID (budget code), and specific date ranges (e.g., `Apollo (ID: BC-2026) [01-08-2026 to 30-11-2026]`).
  - `Leave Details` displays all overlapping leaves for that employee in the range, along with the Project Name, Project ID (budget code) of the associated project (if any), and leave dates (e.g., `On Leave for Apollo (ID: BC-2026) [11-09-2026 to 18-09-2026]`).
- This allows clients to check all allocations and leave gaps for any employee in a structured format in the same page.

### 14. Happy Weekdays Quote Widget & Custom Greeting on Dashboard
- **Greeting Updated**: Changed the desktop header welcome text in the layout to read `Hi Saranya,` as requested.
- **365 Unique Quotes Library**: Added a complete library of 365 unique, professional, motivational, engineering, teamwork, safety, and light-humor workplace quotes in `src/utils/quotes.ts`.
- **Removed Leadership Category**: Removed `"Leadership"` from the valid quote categories. Any quote originally assigned to Leadership is dynamically remapped to the `"Teamwork"` category at runtime, ensuring there are no orphaned categories or compilation errors.
- **Dynamic Weekday Header Label**: Replaced the static header `"Daily Quote"` with a dynamic, day-of-week based greeting: `"Happy [Day Name]"` (e.g. `"Happy Thursday"`).
- **Timezone-Safe Date Layout**: Replaced the UTC-based day calculator with local-based components (`year`, `month`, `date`) ensuring the date display is perfectly synchronized to the client local day.
- **Single-Line Layout & Category Removal**:
  - Completely removed the category badges and bullet icons from the bottom row of the quote widget card. The bottom line now displays only the author's name (`— Sam Walton`).
  - Formatted the text to display quotes on a single line by making the widget container full-width (`w-full`), adjusting the font style (`text-sm sm:text-base font-bold`), and removing internal horizontal constraints (`max-w-none px-2`).

### 15. Dynamic Workforce Insights Widget & Verification Popups
- **New Section Block**: Added a new card widget next to the Weekday Quote card on the Dashboard, titled `📊 Today's Workforce Insights`.
- **Dynamic Calculations**: The widget dynamically pulls statistics from the current planning state.
- **Click-to-Verify Eye Buttons**: Placed a small, custom hoverable `Eye` button next to each of the six insights list items.
- **Audit Verification Popups**: Clicking any `Eye` button opens a styled centered popup modal dialog listing the raw underlying data items to let the client audit and verify.

### 16. Unified Cross-Tab Master Search
- **Universal Filters**: Re-wired the search filters across all views—**Master Sheet (Employees database, Project allocations, Projects tabs)**, **Planning Grid Matrix**, **Availability Finder**, **Attendance Matrix**, and **Leave Management**—to search cross-relationally.
- **Five-Column Matching**: Entering text into any of these search input boxes will now successfully find and query:
  - **Employee**: matches Employee Name, ID, or Designation.
  - **Project**: matches Project Name.
  - **Department**: matches Department name (e.g., `Engineering`, `Admin`).
  - **Budget Code / Project Code**: matches Project Budget Codes (e.g., `BC-APL-202`) for any assigned project.

### 17. Detailed Audit Popup Project Fields
- **Project Name and Code**: In the `Employees Returning from Leave This Week` audit popup and the `Scheduling Conflicts` list popup, the items now explicitly lookup and display the project name and the project budget/code associated with the records.

### 18. Calendar Week Calculation for Returns
- **Sunday-to-Saturday bounds**: Modified the "Employees returning from leave this week" bounds check to strictly calculate the start of the week (Sunday) and the end of the week (Saturday) in the client's local timezone. Dates falling in the next week (e.g., `23-07-2026`) are correctly grouped into next week and excluded from this week's active list count.

### 19. Audit Log Employee Name Inclusion
- **Audit Description Builder**: Added profile resolution inside the Firestore mutation methods (`addAssignment`, `editAssignment`, `deleteAssignment`) in `usePlanningState.ts` so that descriptions explicitly log the employee's name next to the ID.
- **Property Difference Inspector**: Integrated profile resolution checks in the Property Difference Inspector (`AuditLogView.tsx`). If an audited record contains `employeeId`, the inspector dynamically queries `profiles` to resolve the employee's name, inserting an `Employee Name` row directly into the created/deleted key-value grid, and adding an `Employee: [Name] ([Id])` context badge to the header of the update comparison panel.

### 20. Working Employees Today Insight
- **Removed Sync Status**: Removed the static `"Planning synchronization completed successfully"` list item from the Workforce Insights widget card.
- **Working Count Added**: Inserted a dynamic count item: `• X Employees are working today.`
- **Details Audit lookup**: Linking the item to an audit modal popup that lists working employees, their profiles (Name, ID, department, designation), and their active project name and budget/project code today.

### 21. Blinking Conflict Alerts
- **Dynamic Flashing Row**: When scheduling conflicts exist (`conflictCount > 0`), the entire conflicts item row in the insights widget dynamically pulses red using the `animate-pulse` animations helper class, and shows a warning icon (`⚠️`) instead of the standard bullet dot to alert the user instantly.
