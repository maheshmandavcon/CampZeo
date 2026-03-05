import * as XLSX from 'xlsx';
import * as path from 'path';

const data = [
    ["Feature", "Implementation Item", "Technical Approach", "Verification Step"],
    ["Global Report Settings", "Pagination Limit Update", "Change default limit from 5 to 50 in API and Frontend", "Ensure 50 records display per page"],
    ["Backend API", "Advanced Sorting", "Add `sortField` and `sortOrder` to `/api/analytics/reports/posts` query params", "Verify SQL orderBy updates correctly"],
    ["Backend API", "Date Filtering", "Add `startDate` and `endDate` to API to filter `postTransaction` by `publishedAt`", "Verify posts are within date range"],
    ["Frontend - Performance Tab", "Campaign Overview Section", "High-level summary (Best vs Least) using aggregated engagement data", "Check 'Best' campaign matches highest engagement"],
    ["Frontend - Performance Tab", "Dynamic Post Table", "Add clickable headers for sorting and a 'Jump to Page' input", "Test sorting by likes/reach and page jumping"],
    ["Frontend - Performance Tab", "First/Last Page Navigation", "Update pagination component with First page and Last page shortcuts", "Navigate to first and last pages instantly"],
    ["Frontend - Reports Tab", "VS Battle Feature", "New side-by-side comparison view for campaigns/platforms with charts", "Compare two campaigns and check chart accuracy"],
    ["Social Insights API", "Optimized Aggregation", "Reduce over-fetching by using Prisma `_sum` and `groupBy` on filtered sets", "Monitor API response time for large datasets"]
];

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(data);

// Formatting - Set column widths
worksheet['!cols'] = [
    { wch: 30 }, // Feature
    { wch: 30 }, // Implementation Item
    { wch: 60 }, // Technical Approach
    { wch: 40 }  // Verification Step
];

XLSX.utils.book_append_sheet(workbook, worksheet, "Implementation Plan");

const filePath = path.join('C:\\Users\\mahes\\.gemini\\antigravity\\brain\\556b921c-73a0-4370-b2fd-4259236d91ff', 'implementation_plan.xlsx');
XLSX.writeFile(workbook, filePath);

console.log(`Excel file created at: ${filePath}`);
