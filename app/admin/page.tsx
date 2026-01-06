"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Settings,
  Shield,
  MessageSquare,
  MoreVertical,
  CheckCircle,
  Plus,
  ArrowLeft,
  Search,
  Printer,
  ExternalLink,
  Mail,
  Smartphone,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  ChevronLeft,
  Eye,
  EyeOff,
  ChevronRight,
  Download,
  X,
  Trash,
  FileJson
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SecretInput } from "@/components/ui/secret-input";
import { useUser, UserButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { constants } from "buffer";
import { JSX } from "react/jsx-runtime";
import { AdminBroadcastNotification } from "@/components/admin/admin-broadcast-notification";
import { AdminSchedulerView } from "@/components/admin/admin-scheduler-view";
import { Clock } from "lucide-react";

// JSON Viewer Component with Syntax Highlighting
const JsonViewer = ({ jsonString }: { jsonString: string }) => {
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(jsonString);
      setParsedJson(parsed);
      setParseError(null);
    } catch (error) {
      setParseError("Invalid JSON format");
      setParsedJson(null);
    }
  }, [jsonString]);

  const renderValue = (value: any, indent: number = 0): JSX.Element => {
    const indentStr = "  ".repeat(indent);

    if (value === null) {
      return <span className="text-purple-400">null</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-orange-400">{value.toString()}</span>;
    }

    if (typeof value === "number") {
      return <span className="text-cyan-400">{value}</span>;
    }

    if (typeof value === "string") {
      return <span className="text-green-400">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-slate-400">[]</span>;
      }
      return (
        <span>
          <span className="text-slate-400">[</span>
          <div className="ml-4">
            {value.map((item, index) => (
              <div key={index}>
                {renderValue(item, indent + 1)}
                {index < value.length - 1 && <span className="text-slate-400">,</span>}
              </div>
            ))}
          </div>
          <span className="text-slate-400">]</span>
        </span>
      );
    }

    if (typeof value === "object") {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return <span className="text-slate-400">{"{}"}</span>;
      }
      return (
        <span>
          <span className="text-slate-400">{"{"}</span>
          <div className="ml-4">
            {keys.map((key, index) => (
              <div key={key} className="my-1">
                <span className="text-blue-400">"{key}"</span>
                <span className="text-slate-400">: </span>
                {renderValue(value[key], indent + 1)}
                {index < keys.length - 1 && <span className="text-slate-400">,</span>}
              </div>
            ))}
          </div>
          <span className="text-slate-400">{"}"}</span>
        </span>
      );
    }

    return <span className="text-slate-400">{String(value)}</span>;
  };

  if (parseError) {
    return (
      <div className="text-red-400 p-4 bg-red-950/20 rounded border border-red-800">
        <div className="font-semibold mb-2">⚠ {parseError}</div>
        <div className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-all">
          {jsonString}
        </div>
      </div>
    );
  }

  if (!parsedJson) {
    return <div className="text-slate-400">Loading...</div>;
  }

  return <div className="text-slate-100 leading-relaxed">{renderValue(parsedJson)}</div>;
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("organisations");
  const { user } = useUser();
  // Data State
  const [organisations, setOrganisations] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [platformConfigs, setPlatformConfigs] = useState<any[]>([]);
  const [jobSettings, setJobSettings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [billingPlans, setBillingPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination & Filter State
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'active', 'suspended'

  // Debounce search text
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageNumber(1);
      setDebouncedSearchText(searchText);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Enquiry Filter State
  const [enquirySearch, setEnquirySearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Logs Pagination State
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize] = useState(10);
  const [logsTotalCount, setLogsTotalCount] = useState(0);
  const [logsTotalPages, setLogsTotalPages] = useState(0);

  // Logs Filter State
  const [logsKeyword, setLogsKeyword] = useState("");
  const [logsLevel, setLogsLevel] = useState("all"); // 'all', 'Info', 'Warning', 'Error'
  const [logsDateFrom, setLogsDateFrom] = useState("");
  const [logsDateTo, setLogsDateTo] = useState("");

  // Billing Plans State
  const [plansSearch, setPlansSearch] = useState("");
  const [plansStatusFilter, setPlansStatusFilter] = useState("all");
  const [plansSortBy, setPlansSortBy] = useState("name");

  // Billing Plan Form State
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planFormData, setPlanFormData] = useState({
    name: "",
    description: "",
    price: "",
    billingCycle: "MONTHLY",
    isActive: true,
    autoRenew: true
  });
  const [planFeatures, setPlanFeatures] = useState<string[]>([""]);
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});
  const [hasActiveSubscriptions, setHasActiveSubscriptions] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Delete Plan State
  const [deletingPlan, setDeletingPlan] = useState<any | null>(null);
  const [affectedOrganisations, setAffectedOrganisations] = useState<any[]>([]);
  const [selectedMigrationPlan, setSelectedMigrationPlan] = useState<string>("");
  const [deleteConfirmationChecked, setDeleteConfirmationChecked] = useState(false);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);


  // Add/Edit Org Form State
  const [isAddingOrg, setIsAddingOrg] = useState(false);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    ownerName: "",
    phone: "",
    email: "",
    taxNumber: "",
    address: "",
    postalCode: "",
    city: "",
    state: "",
    country: "",
    platforms: [] as string[],
    isFreeTrial: false
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Approval Modal State
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalData, setApprovalData] = useState({
    orgId: "",
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: ""
  });

  // Properties Viewer Modal State
  const [propertiesModalOpen, setPropertiesModalOpen] = useState(false);
  const [selectedLogProperties, setSelectedLogProperties] = useState<string | null>(null);
  const [selectedLogException, setSelectedLogException] = useState<string | null>(null);

  // Fetch Data
  const fetchOrganisations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
        searchText: debouncedSearchText,
        sortBy: 'createdAt',
        sortDesc: 'true'
      });

      // Only add isDeleted filter if not 'all'
      if (statusFilter === 'suspended') {
        params.append('isDeleted', 'true');
      } else if (statusFilter === 'active') {
        params.append('isDeleted', 'false');
        params.append('isApproved', 'true');
      }
      // For 'all', don't add isDeleted parameter to show both

      const res = await fetch(`/api/admin/organisations?${params}`);
      const data = await res.json();

      if (data.isSuccess) {
        setOrganisations(data.data.list);
        setTotalCount(data.data.totalCount);
      }
    } catch (error) {
      toast.error("Failed to fetch organisations");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOtherData = async () => {
    try {
      // Build logs query parameters
      const logsParams = new URLSearchParams({
        page: logsPage.toString(),
        pageSize: logsPageSize.toString()
      });

      if (logsKeyword) logsParams.append('keyword', logsKeyword);
      if (logsLevel !== 'all') logsParams.append('level', logsLevel);
      if (logsDateFrom) logsParams.append('dateFrom', logsDateFrom);
      if (logsDateTo) logsParams.append('dateTo', logsDateTo);

      const [enqRes, confRes, jobsRes, logsRes] = await Promise.all([
        fetch('/api/admin/enquiries'),
        fetch('/api/admin/platform-config'),
        fetch('/api/admin/job-settings'),
        fetch(`/api/admin/logs?${logsParams}`)
      ]);

      if (enqRes.ok) {
        const data = await enqRes.json();
        setEnquiries(data.data || []);
      } else {
        const errorData = await enqRes.json();
        toast.error(`Failed to fetch enquiries: ${errorData.message || 'Access denied'}`);
      }

      if (confRes.ok) setPlatformConfigs((await confRes.json()).data || []);
      if (jobsRes.ok) setJobSettings((await jobsRes.json()).data || []);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (logsData.isSuccess && logsData.data) {
          setLogs(logsData.data.logs || []);
          setLogsTotalCount(logsData.data.totalCount || 0);
          setLogsTotalPages(logsData.data.totalPages || 0);
        }
      }

      // Fetch billing plans
      const plansRes = await fetch('/api/admin/billing-plans');
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        if (plansData.isSuccess) {
          setBillingPlans(plansData.data || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch other data", error);
      toast.error("Failed to load admin data");
    }
  };

  useEffect(() => {
    if (activeTab === 'organisations') {
      fetchOrganisations();
    } else if (activeTab === 'logs') {
      fetchOtherData();
    } else {
      fetchOtherData();
    }
  }, [activeTab, pageNumber, pageSize, statusFilter, logsPage, logsKeyword, logsLevel, logsDateFrom, logsDateTo, debouncedSearchText]);

  // Handle Search Enter
  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPageNumber(1);
      fetchOrganisations();
    }
  };

  // Filter enquiries based on search and date range
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter(enq => {
      // Search filter (name, email, organisation)
      const searchLower = enquirySearch.toLowerCase();
      const matchesSearch = !enquirySearch ||
        (enq.name && enq.name.toLowerCase().includes(searchLower)) ||
        (enq.organisationName && enq.organisationName.toLowerCase().includes(searchLower)) ||
        (enq.email && enq.email.toLowerCase().includes(searchLower));

      // Date range filter
      const createdDate = new Date(enq.createdAt);
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? new Date(dateTo) : null;

      // Set time to start/end of day for accurate comparison
      if (fromDate) fromDate.setHours(0, 0, 0, 0);
      if (toDate) toDate.setHours(23, 59, 59, 999);

      const matchesDateFrom = !fromDate || createdDate >= fromDate;
      const matchesDateTo = !toDate || createdDate <= toDate;

      return matchesSearch && matchesDateFrom && matchesDateTo;
    });
  }, [enquiries, enquirySearch, dateFrom, dateTo]);

  // Organisation Actions
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingOrg(true);
    // Validation
    setFormErrors({});
    const errors: Record<string, string> = {};
    let hasError = false;

    if (!formData.name.trim()) { errors.name = "Organisation Name is required"; hasError = true; }
    if (!formData.ownerName.trim()) { errors.ownerName = "Owner Name is required"; hasError = true; }

    // Phone validation
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!formData.phone) {
      errors.phone = "Phone number is required"; hasError = true;
    } else if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
      errors.phone = "Invalid phone number format"; hasError = true;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      errors.email = "Email is required"; hasError = true;
    } else if (!emailRegex.test(formData.email)) {
      errors.email = "Invalid email address"; hasError = true;
    }

    if (!formData.taxNumber.trim()) { errors.taxNumber = "Tax Number is required"; hasError = true; }
    if (!formData.address.trim()) { errors.address = "Address is required"; hasError = true; }
    if (!formData.postalCode.trim()) { errors.postalCode = "Postal Code is required"; hasError = true; }
    if (!formData.city.trim()) { errors.city = "City is required"; hasError = true; }
    if (!formData.state.trim()) { errors.state = "State is required"; hasError = true; }
    if (!formData.country.trim()) { errors.country = "Country is required"; hasError = true; }

    if (hasError) {
      setFormErrors(errors);
      toast.error("Please fill in all required fields marked in red.");
      setIsCreatingOrg(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        organisationPlatform: formData.platforms, // Send as string array directly
      };

      const res = await fetch("/api/admin/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.isSuccess) {
        toast.success(formData.id ? "Organisation updated" : "Organisation created successfully");
        setFormData({
          id: "",
          name: "",
          ownerName: "",
          phone: "",
          email: "",
          taxNumber: "",
          address: "",
          postalCode: "",
          city: "",
          state: "",
          country: "",
          platforms: [],
          isFreeTrial: false
        });
        setIsAddingOrg(false);
        fetchOrganisations();
      } else {
        throw new Error(data.message || "Failed to save organisation");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleEditOrg = (org: any) => {
    let parsedPlatforms = [];
    try {
      if (org.platforms && typeof org.platforms === 'string') {
        parsedPlatforms = JSON.parse(org.platforms);
      } else if (Array.isArray(org.platforms)) {
        parsedPlatforms = org.platforms;
      }
    } catch (e) {
      console.error('Error parsing platforms:', e);
      parsedPlatforms = [];
    }

    setFormData({
      id: org.id,
      name: org.name,
      ownerName: org.ownerName || "",
      phone: org.phone || "",
      email: org.email || "",
      taxNumber: org.taxNumber || "",
      address: org.address || "",
      postalCode: org.postalCode || "",
      city: org.city || "",
      state: org.state || "",
      country: org.country || "",
      platforms: parsedPlatforms,
      isFreeTrial: org.plan === 'FREE_TRIAL'
    });
    setIsAddingOrg(true);
  };

  const handleApproveClick = (org: any) => {
    // Check if user exists (in DB)
    // The list API includes 'users', so we can check that array.
    const hasUser = org.users && org.users.length > 0;

    if (hasUser) {
      // User exists, just approve directly
      handleApproveOrg(org.id);
      return;
    }

    // No user exists, show modal to create one
    const nameParts = (org.ownerName || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const email = org.email || "";
    // Generate a simple username from email or name
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, "") || firstName.toLowerCase();

    setApprovalData({
      orgId: org.id,
      firstName,
      lastName,
      username,
      email,
      password: ""
    });
    setApprovalModalOpen(true);
  };

  const submitApproval = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!approvalData.firstName || !approvalData.email || !approvalData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      toast.loading("Approving organisation and creating user...");
      const res = await fetch(`/api/admin/organisations/${approvalData.orgId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: approvalData.firstName,
          lastName: approvalData.lastName,
          username: approvalData.username,
          email: approvalData.email,
          password: approvalData.password
        })
      });
      const data = await res.json();

      toast.dismiss(); // Dismiss loading toast

      if (res.ok && data.isSuccess) {
        toast.success("Organisation approved and user created successfully");
        setApprovalModalOpen(false);
        fetchOrganisations();
      } else {
        throw new Error(data.message);
      }
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message || "Failed to approve organisation");
    }
  };

  const handleApproveOrg = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/organisations/${id}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        toast.success("Organisation approved");
        fetchOrganisations();
      } else throw new Error(data.message);
    } catch (e: any) {
      toast.error(e.message || "Failed to approve organisation");
    }
  };

  const handleSuspendOrg = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/organisations/${id}/suspend`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        toast.success(data.message);
        fetchOrganisations();
      } else throw new Error(data.message);
    } catch (e: any) {
      toast.error(e.message || "Failed to update organisation status");
    }
  };

  const handleImpersonate = async (orgId: string) => {
    if (!orgId) {
      toast.error("Invalid organisation ID");
      return;
    }

    try {
      toast.loading("Generating access token...");

      const res = await fetch(`/api/admin/organisations/${orgId}/impersonate`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok && data.isSuccess) {
        toast.success("Opening organisation dashboard...");
        // Set a cookie to track impersonation state
        document.cookie = `admin_impersonation=${orgId}; path=/; max-age=3600`;
        // Open the sign-in URL in the same tab
        window.location.href = data.data.signInUrl;
      } else {
        throw new Error(data.message || "Failed to generate access token");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to impersonate user");
    }
  };

  // ... (Other handlers: Enquiry, Config, Jobs, Notifications - kept same or simplified)
  const handleApproveEnquiry = async (id: string) => { /* ... */ };
  const handleUpdateConfig = async (key: string, value: string, platform: string) => {
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, platform })
      });
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        toast.success("Configuration updated");
        setPlatformConfigs(prev => {
          const existing = prev.find(p => p.key === key);
          if (existing) {
            return prev.map(p => p.key === key ? { ...p, value } : p);
          } else {
            return [...prev, { key, value, platform }]; // Optimistic update might need more fields but this is fine for now
          }
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update configuration");
    }
  };
  const handleUpdateJob = async (jobName: string, frequency: string, isEnabled: boolean) => { /* ... */ };
  const handleSendNotification = async (message: string) => { /* ... */ };

  const togglePlatform = (platform: string) => {
    setFormData(prev => {
      const platforms = prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform];
      return { ...prev, platforms };
    });
  };

  const PlatformIcon = ({ name, icon: Icon, label }: { name: string, icon: any, label: string }) => (
    <div
      className={`flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all ${formData.platforms.includes(name) ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
      onClick={() => togglePlatform(name)}
    >
      <Icon className={`size-6 mb-2 ${formData.platforms.includes(name) ? 'text-primary' : 'text-muted-foreground'}`} />
      <span className="text-xs">{label}</span>
      <div className={`w-4 h-4 rounded-full border mt-2 flex items-center justify-center ${formData.platforms.includes(name) ? 'border-primary' : 'border-muted-foreground'}`}>
        {formData.platforms.includes(name) && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
    </div>
  );

  async function handleConvertToOrg(enq: any): Promise<void> {
    try {
      toast.loading("Creating organisation and user account...");

      // Call the server-side API to handle all Clerk and database operations
      const res = await fetch("/api/admin/convert-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enquiryId: enq.id }),
      });

      const data = await res.json();

      // Dismiss the loading toast first
      toast.dismiss();

      if (!res.ok || !data.isSuccess) {
        throw new Error(data.error || data.details || "Failed to convert enquiry");
      }

      // Update local state
      setEnquiries(prev => prev.map(e =>
        e.id === enq.id ? { ...e, isConverted: true } : e
      ));

      toast.success("Organisation created and user invited successfully!");
      fetchOrganisations(); // Refresh organisations list
    } catch (error: any) {
      console.error("Error converting enquiry to organisation:", error);
      toast.dismiss(); // Dismiss loading toast on error too
      toast.error(error.message || "Failed to create organisation");
    }
  }

  // Billing Plan Form Handlers
  const handleCreatePlanClick = () => {
    setPlanFormData({
      name: "",
      description: "",
      price: "",
      billingCycle: "MONTHLY",
      isActive: true,
      autoRenew: true
    });
    setPlanFeatures([""]);
    setPlanErrors({});
    setEditingPlanId(null);
    setHasActiveSubscriptions(false);
    setIsEditingPlan(true);
  };

  const handleEditPlanClick = async (plan: any) => {
    try {
      // Fetch full plan details
      const res = await fetch(`/api/admin/billing-plans/${plan.id}`);
      const data = await res.json();

      if (data.isSuccess) {
        const planData = data.data;
        setPlanFormData({
          name: planData.name,
          description: planData.description || "",
          price: planData.price.toString(),
          billingCycle: planData.billingCycle,
          isActive: planData.isActive,
          autoRenew: planData.autoRenew
        });
        setPlanFeatures(Array.isArray(planData.features) ? planData.features : [""]);
        setHasActiveSubscriptions(planData.activeSubscriptions > 0);
        setEditingPlanId(plan.id);
        setPlanErrors({});
        setIsEditingPlan(true);
      } else {
        toast.error(data.message || "Failed to fetch plan details");
      }
    } catch (error) {
      console.error("Error fetching plan:", error);
      toast.error("Failed to load plan details");
    }
  };

  const handleCancelPlanForm = () => {
    setIsEditingPlan(false);
    setEditingPlanId(null);
    setPlanFormData({
      name: "",
      description: "",
      price: "",
      billingCycle: "MONTHLY",
      isActive: true,
      autoRenew: true
    });
    setPlanFeatures([""]);
    setPlanErrors({});
    setHasActiveSubscriptions(false);
  };

  const handleAddPlanFeature = () => {
    setPlanFeatures([...planFeatures, ""]);
  };

  const handleRemovePlanFeature = (index: number) => {
    if (planFeatures.length > 1) {
      setPlanFeatures(planFeatures.filter((_, i) => i !== index));
    }
  };

  const handlePlanFeatureChange = (index: number, value: string) => {
    const newFeatures = [...planFeatures];
    newFeatures[index] = value;
    setPlanFeatures(newFeatures);
  };

  const validatePlanForm = () => {
    const newErrors: Record<string, string> = {};

    if (!planFormData.name.trim()) {
      newErrors.name = "Plan name is required";
    }

    if (!planFormData.price || parseFloat(planFormData.price) < 0) {
      newErrors.price = "Valid price is required (must be >= 0)";
    }

    const validFeatures = planFeatures.filter(f => f.trim());
    if (validFeatures.length === 0) {
      newErrors.features = "At least one feature is required";
    }

    setPlanErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePlanForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    try {
      setIsSavingPlan(true);

      const validFeatures = planFeatures.filter(f => f.trim());
      const isEditing = !!editingPlanId;

      let requestData: any = {
        name: planFormData.name,
        description: planFormData.description,
        features: validFeatures,
        isActive: planFormData.isActive,
        autoRenew: planFormData.autoRenew
      };

      // Only include price and billingCycle for new plans or plans without active subscriptions
      if (!isEditing || !hasActiveSubscriptions) {
        requestData.price = parseFloat(planFormData.price);
        requestData.billingCycle = planFormData.billingCycle;
      }

      const url = isEditing
        ? `/api/admin/billing-plans/${editingPlanId}`
        : "/api/admin/billing-plans";

      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
      });

      const data = await res.json();

      if (data.isSuccess) {
        toast.success(isEditing ? "Plan updated successfully" : "Plan created successfully");
        handleCancelPlanForm();
        // Refresh billing plans
        fetchOtherData();
      } else {
        toast.error(data.message || `Failed to ${isEditing ? 'update' : 'create'} plan`);
        if (data.message?.includes("already exists")) {
          setPlanErrors({ name: data.message });
        }
      }
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Failed to save plan");
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Delete Plan Handlers
  const handleDeletePlanClick = async (plan: any) => {
    try {
      // Fetch affected users
      const res = await fetch(`/api/admin/billing-plans/${plan.id}/affected-users`);
      const data = await res.json();

      if (data.isSuccess) {
        setDeletingPlan(plan);
        setAffectedOrganisations(data.data.organisations || []);
        setSelectedMigrationPlan("");
        setDeleteConfirmationChecked(false);
      } else {
        toast.error(data.message || "Failed to fetch affected users");
      }
    } catch (error) {
      console.error("Error fetching affected users:", error);
      toast.error("Failed to load affected users");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPlan) return;

    // Validation
    if (affectedOrganisations.length > 0) {
      if (!selectedMigrationPlan) {
        toast.error("Please select a plan to migrate users to");
        return;
      }
      if (!deleteConfirmationChecked) {
        toast.error("Please confirm the migration");
        return;
      }
    }

    try {
      setIsDeletingPlan(true);

      const requestBody: any = {};
      if (affectedOrganisations.length > 0) {
        requestBody.migrateToPlanId = parseInt(selectedMigrationPlan);
      }

      const res = await fetch(`/api/admin/billing-plans/${deletingPlan.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();

      if (data.isSuccess) {
        toast.success(data.message);
        handleCancelDelete();
        // Refresh billing plans
        fetchOtherData();
      } else {
        toast.error(data.message || "Failed to delete plan");
      }
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast.error("Failed to delete plan");
    } finally {
      setIsDeletingPlan(false);
    }
  };

  const handleCancelDelete = () => {
    setDeletingPlan(null);
    setAffectedOrganisations([]);
    setSelectedMigrationPlan("");
    setDeleteConfirmationChecked(false);
  };

  const exportEnquiriesToCSV = () => {

    if (enquiries.length === 0) {
      toast.error("No enquiries to export");
      return;
    }

    // Define CSV headers
    const headers = [
      "ID",
      "Business Name",
      "Name",
      "Email",
      "Phone",
      "Mobile",
      "Address",
      "City",
      "State",
      "Country",
      "Postal Code",
      "Tax Number",
      "Enquiry Text",
      "Created Date"
    ];

    // Convert enquiries to CSV rows
    const csvRows = [
      headers.join(","), // Header row
      ...enquiries.map(enq => [
        enq.id,
        `"${(enq.organisationName || '').replace(/"/g, '""')}"`,
        `"${(enq.name || '').replace(/"/g, '""')}"`,
        `"${enq.email}"`,
        `"${(enq.phone || '').replace(/"/g, '""')}"`,
        `"${(enq.mobile || '').replace(/"/g, '""')}"`,
        `"${(enq.address || '').replace(/"/g, '""')}"`,
        `"${(enq.city || '').replace(/"/g, '""')}"`,
        `"${(enq.state || '').replace(/"/g, '""')}"`,
        `"${(enq.country || '').replace(/"/g, '""')}"`,
        `"${(enq.postalCode || '').replace(/"/g, '""')}"`,
        `"${(enq.taxNumber || '').replace(/"/g, '""')}"`,
        `"${(enq.enquiryText || '').replace(/"/g, '""')}"`,
        `"${new Date(enq.createdAt).toLocaleString()}"`
      ].join(","))
    ];

    // Create CSV content
    const csvContent = csvRows.join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `enquiries_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${enquiries.length} enquiries to CSV`);
  }

  return (
    <div className="flex flex-col h-screen w-full bg-muted/30 overflow-hidden">
      {/* Header - Full Width */}
      <header className="h-16 border-b bg-background flex items-center justify-between px-6 shrink-0 z-20 relative">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Trigger */}
          <Sheet>
            {/* <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground">
                <MoreVertical className="size-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger> */}
            <SheetContent side="left" className="p-0 w-72 bg-[#0f172a] text-white border-r-slate-800">
              {/* Mobile Menu Content */}
              <div className="p-6">
                <div className="flex items-center gap-2 font-bold text-xl tracking-wide text-white mb-8">
                  <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Shield className="size-5 text-primary" />
                  </div>
                  CampZeo
                </div>
                <div className="flex flex-col gap-1">
                  {['organisations', 'enquiry', 'platform', 'system', 'logs'].map((tab) => (
                    <Button
                      key={tab}
                      variant="ghost"
                      className={`justify-start cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800 ${activeTab === tab ? 'bg-primary text-white' : ''}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      <span className="capitalize">{tab}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 font-semibold">
            <img src="/logo-1.png" alt="CampZeo" className="h-10" />
          </div>
          {/* <div className="flex items-center gap-2 font-bold text-xl tracking-wide text-primary">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="size-5 text-primary" />
            </div>
            <span className="hidden md:inline-block">CampZeo</span>
          </div> */}
        </div>

        <div className="flex items-center gap-4 w-1/3 justify-end md:justify-between md:w-auto lg:w-1/3">
          {/* Global Search - Optional */}
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-muted-foreground cursor-pointer hidden sm:flex">
            <Mail className="size-5" />
          </Button>
          <div className="flex  items-center gap-3">
            {/* <div className="text-right hidden  md:block">
              <p className="text-sm font-medium leading-none">Admin User</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div> */}

            Hi,  {user?.firstName + " " + user?.lastName || user?.username || "User"}   <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Layout - Sidebar + Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex-1 flex flex-row overflow-hidden">
        {/* Sidebar - Desktop */}
        <div className="hidden md:flex w-64 shrink-0   text-white flex-col border-r border-slate-300 overflow-y-auto">
          <div className=" w-full py-6">
            {/* <div className="mb-6 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Main Menu
            </div> */}
            <TabsList className="flex flex-col h-auto items-stretch w-full p-0 gap-1 text-slate-400">
              <TabsTrigger value="organisations" className="justify-start px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white hover:bg-red-800 hover:text-slate-200 transition-all rounded-md mx-2">
                <Users className="mr-3 size-4" /> Organisation
              </TabsTrigger>
              <TabsTrigger value="enquiry" className="justify-start px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white hover:bg-red-800 hover:text-slate-200 transition-all rounded-md mx-2">
                <MessageSquare className="mr-3 size-4" /> Enquiry
              </TabsTrigger>
              <TabsTrigger value="billing-plans" className="justify-start px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white hover:bg-red-800 hover:text-slate-200 transition-all rounded-md mx-2">
                <Shield className="mr-3 size-4" /> Billing Plans
              </TabsTrigger>
              <TabsTrigger value="platform" className="justify-start px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white hover:bg-red-800 hover:text-slate-200 transition-all rounded-md mx-2">
                <Settings className="mr-3 size-4" /> Platform Config
              </TabsTrigger>
              <TabsTrigger value="system" className="justify-start px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white hover:bg-red-800 hover:text-slate-200 transition-all rounded-md mx-2">
                <MoreVertical className="mr-3 size-4" /> Job Settings
              </TabsTrigger>
              <TabsTrigger value="logs" className="justify-start px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white hover:bg-red-800 hover:text-slate-200 transition-all rounded-md mx-2">
                <CheckCircle className="mr-3 size-4" /> Audit Logs
              </TabsTrigger>
              <TabsTrigger value="scheduler" className="justify-start px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white hover:bg-red-800 hover:text-slate-200 transition-all rounded-md mx-2">
                <Clock className="mr-3 size-4" /> Scheduler
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8" >
          <div className=" mx-auto space-y-6">

            {/* 1. Organisation Management */}
            <TabsContent value="organisations" className="m-0 space-y-6 focus-visible:outline-none" >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Organisations</h2>
                  <p className="text-muted-foreground">Manage and monitor all tenant organisations.</p>
                </div>
              </div>

              <Card className="border shadow-sm bg-white">
                {isAddingOrg ? (
                  <>
                    <CardHeader className="border-b pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{formData.id ? 'Edit Organisation' : 'Add Organisation'}</CardTitle>
                          <CardDescription>Enter the details for the organisation.</CardDescription>
                        </div>
                        <Button variant="ghost" className="cursor-pointer" size="sm" onClick={() => setIsAddingOrg(false)}>
                          <ArrowLeft className="mr-2 size-4" /> Back to List
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <form onSubmit={handleCreateOrg} className="space-y-8">
                        <div className="space-y-6">
                          <div className="form-grid-2-col">
                            <div className="space-y-2">
                              <Label htmlFor="orgName">Organisation Name <span className="text-red-500">*</span></Label>
                              <Input
                                id="orgName"
                                className={formErrors.name ? "border-red-500 ring-offset-red-100" : ""}
                                value={formData.name}
                                onChange={(e) => {
                                  setFormData({ ...formData, name: e.target.value });
                                  if (formErrors.name) setFormErrors({ ...formErrors, name: "" });
                                }}
                                placeholder="e.g. Mobile team"
                              />
                              {formErrors.name && <p className="text-xs text-red-500 font-medium">{formErrors.name}</p>}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="ownerName">Owner Name <span className="text-red-500">*</span></Label>
                              <Input
                                id="ownerName"
                                className={formErrors.ownerName ? "border-red-500 ring-offset-red-100" : ""}
                                value={formData.ownerName}
                                onChange={(e) => {
                                  setFormData({ ...formData, ownerName: e.target.value });
                                  if (formErrors.ownerName) setFormErrors({ ...formErrors, ownerName: "" });
                                }}
                                placeholder="e.g. John Doe"
                              />
                              {formErrors.ownerName && <p className="text-xs text-red-500 font-medium">{formErrors.ownerName}</p>}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="phone">Phone <span className="text-red-500">*</span></Label>
                              <Input
                                id="phone"
                                className={formErrors.phone ? "border-red-500 ring-offset-red-100" : ""}
                                value={formData.phone}
                                onChange={(e) => {
                                  setFormData({ ...formData, phone: e.target.value });
                                  if (formErrors.phone) setFormErrors({ ...formErrors, phone: "" });
                                }}
                                placeholder="e.g. 7807271261"
                              />
                              {formErrors.phone && <p className="text-xs text-red-500 font-medium">{formErrors.phone}</p>}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="email">Email address <span className="text-red-500">*</span></Label>
                              <Input
                                id="email"
                                type="email"
                                className={formErrors.email ? "border-red-500 ring-offset-red-100" : ""}
                                value={formData.email}
                                onChange={(e) => {
                                  setFormData({ ...formData, email: e.target.value });
                                  if (formErrors.email) setFormErrors({ ...formErrors, email: "" });
                                }}
                                placeholder="e.g. contact@example.com"
                              />
                              {formErrors.email && <p className="text-xs text-red-500 font-medium">{formErrors.email}</p>}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="taxNumber">Tax Number <span className="text-red-500">*</span></Label>
                              <Input
                                id="taxNumber"
                                className={formErrors.taxNumber ? "border-red-500 ring-offset-red-100" : ""}
                                value={formData.taxNumber}
                                onChange={(e) => {
                                  setFormData({ ...formData, taxNumber: e.target.value });
                                  if (formErrors.taxNumber) setFormErrors({ ...formErrors, taxNumber: "" });
                                }}
                                placeholder="e.g. TEMP123"
                              />
                              {formErrors.taxNumber && <p className="text-xs text-red-500 font-medium">{formErrors.taxNumber}</p>}
                            </div>
                          </div>

                          <div className="border-t pt-4">
                            <h4 className="text-sm font-medium mb-4 text-muted-foreground">Address Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="address">Address <span className="text-red-500">*</span></Label>
                                <Input
                                  id="address"
                                  className={formErrors.address ? "border-red-500 ring-offset-red-100" : ""}
                                  value={formData.address}
                                  onChange={(e) => {
                                    setFormData({ ...formData, address: e.target.value });
                                    if (formErrors.address) setFormErrors({ ...formErrors, address: "" });
                                  }}
                                  placeholder="e.g. Village Karehari"
                                />
                                {formErrors.address && <p className="text-xs text-red-500 font-medium">{formErrors.address}</p>}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="postalCode">Postal Code <span className="text-red-500">*</span></Label>
                                <Input
                                  id="postalCode"
                                  className={formErrors.postalCode ? "border-red-500 ring-offset-red-100" : ""}
                                  value={formData.postalCode}
                                  onChange={(e) => {
                                    setFormData({ ...formData, postalCode: e.target.value });
                                    if (formErrors.postalCode) setFormErrors({ ...formErrors, postalCode: "" });
                                  }}
                                  placeholder="e.g. 175021"
                                />
                                {formErrors.postalCode && <p className="text-xs text-red-500 font-medium">{formErrors.postalCode}</p>}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
                                <Input
                                  id="city"
                                  className={formErrors.city ? "border-red-500 ring-offset-red-100" : ""}
                                  value={formData.city}
                                  onChange={(e) => {
                                    setFormData({ ...formData, city: e.target.value });
                                    if (formErrors.city) setFormErrors({ ...formErrors, city: "" });
                                  }}
                                  placeholder="e.g. Mandi"
                                />
                                {formErrors.city && <p className="text-xs text-red-500 font-medium">{formErrors.city}</p>}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="state">State <span className="text-red-500">*</span></Label>
                                <Input
                                  id="state"
                                  className={formErrors.state ? "border-red-500 ring-offset-red-100" : ""}
                                  value={formData.state}
                                  onChange={(e) => {
                                    setFormData({ ...formData, state: e.target.value });
                                    if (formErrors.state) setFormErrors({ ...formErrors, state: "" });
                                  }}
                                  placeholder="e.g. Himachal Pradesh"
                                />
                                {formErrors.state && <p className="text-xs text-red-500 font-medium">{formErrors.state}</p>}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="country">Country <span className="text-red-500">*</span></Label>
                                <Input
                                  id="country"
                                  className={formErrors.country ? "border-red-500 ring-offset-red-100" : ""}
                                  value={formData.country}
                                  onChange={(e) => {
                                    setFormData({ ...formData, country: e.target.value });
                                    if (formErrors.country) setFormErrors({ ...formErrors, country: "" });
                                  }}
                                  placeholder="e.g. India"
                                />
                                {formErrors.country && <p className="text-xs text-red-500 font-medium">{formErrors.country}</p>}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <Label>Choose your Platforms</Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                            <PlatformIcon name="email" icon={Mail} label="Email" />
                            <PlatformIcon name="sms" icon={Smartphone} label="SMS" />
                            <PlatformIcon name="whatsapp" icon={MessageSquare} label="WhatsApp" />
                            <PlatformIcon name="facebook" icon={Facebook} label="Facebook" />
                            <PlatformIcon name="instagram" icon={Instagram} label="Instagram" />
                            <PlatformIcon name="linkedin" icon={Linkedin} label="LinkedIn" />
                            <PlatformIcon name="youtube" icon={Youtube} label="Youtube" />
                            <PlatformIcon name="pinterest" icon={Settings} label="Pinterest" />
                          </div>
                        </div>

                        <div className="flex gap-4 pt-4 border-t">
                          <Button type="submit" className="cursor-pointer" disabled={isCreatingOrg}>Submit</Button>
                          <Button type="button" className="cursor-pointer" variant="outline" onClick={() => setIsAddingOrg(false)}>Cancel</Button>
                        </div>
                      </form>
                    </CardContent>
                  </>
                ) : (
                  <>
                    <div className="p-4 border-b flex items-center justify-between gap-4 bg-slate-50/50">
                      <div className="flex gap-2 w-full md:w-auto flex-1 md:flex-none">
                        <div className="relative w-1/2 md:w-80">
                          <Search className="absolute   size-4 text-muted-foreground" style={{ top: "10px", left: "10px" }} />
                          <Input
                            placeholder="Search by name, email..."
                            className="pl-9 bg-white"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                          />
                        </div>
                        <div className="hidden border border-1 rounded-md sm:block">
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px] bg-white border">
                              <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex  gap-2 w-1/2 md:w-auto justify-end">
                        <Button size="sm" className="cursor-pointer" onClick={() => {
                          setFormData({
                            id: "",
                            name: "",
                            ownerName: "",
                            phone: "",
                            email: "",
                            taxNumber: "",
                            address: "",
                            postalCode: "",
                            city: "",
                            state: "",
                            country: "",
                            platforms: [],
                            isFreeTrial: false
                          });
                          setIsAddingOrg(true);
                        }}>
                          <Plus className="mr-2 size-4" /> Add New
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-slate-50 ">
                          <TableRow>
                            <TableHead className="font-semibold text-slate-700">Name</TableHead>
                            <TableHead className="font-semibold text-slate-700  md:table-cell">Phone</TableHead>
                            <TableHead className="font-semibold text-slate-700  lg:table-cell">Email</TableHead>
                            <TableHead className="font-semibold text-slate-700  xl:table-cell">Address</TableHead>
                            <TableHead className="font-semibold text-slate-700">Owner</TableHead>
                            <TableHead className="font-semibold text-slate-700">Status</TableHead>
                            <TableHead className="font-semibold text-slate-700">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={7} className="h-24 text-center">
                                <div className="flex justify-center items-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                  Loading organisations...
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            organisations.map((org) => (
                              <TableRow key={org.id} className="hover:bg-slate-50/50">
                                <TableCell className="font-medium">{org.name}</TableCell>
                                <TableCell className=" md:table-cell">{org.phone || 'N/A'}</TableCell>
                                <TableCell className=" lg:table-cell">{org.email || org.users?.[0]?.email || 'N/A'}</TableCell>
                                <TableCell className="max-w-[200px] truncate  xl:table-cell" title={org.address}>{org.address || 'N/A'}</TableCell>
                                <TableCell>{org.ownerName || org.users?.[0]?.firstName || 'N/A'}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Badge variant={org.isApproved ? 'default' : 'secondary'} className="rounded-md font-normal">
                                      {org.isApproved ? 'Approved' : 'Pending'}
                                    </Badge>
                                    {org.isDeleted && <Badge variant="destructive" className="rounded-md font-normal">Suspended</Badge>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2 ">
                                    {!org.isApproved && (
                                      <Button size="sm" className="h-8 px-2 cursor-pointer bg-green-600 hover:bg-green-700" onClick={() => handleApproveClick(org)}>Approve</Button>
                                    )}
                                    <Button size="sm" className="h-8 px-2 cursor-pointer bg-blue-600 hover:bg-blue-700" onClick={() => handleImpersonate(org.id)}>Login</Button>
                                    <Button size="sm" className="h-8 px-2 cursor-pointer bg-indigo-500 hover:bg-indigo-600" onClick={() => handleEditOrg(org)}>Edit</Button>
                                    {org.isApproved && (
                                      <Button size="sm" variant={org.isDeleted ? "outline" : "destructive"} className="h-8 px-2 cursor-pointer" onClick={() => handleSuspendOrg(org.id)}>
                                        {org.isDeleted ? "Recover" : "Suspend"}
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )))}
                          {organisations.length === 0 && !isLoading && (
                            <TableRow>
                              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                No organisations found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>


                      {/* Approval Modal */}
                      <Dialog open={approvalModalOpen} onOpenChange={setApprovalModalOpen}>
                        <DialogContent className="w-1/2">
                          <DialogHeader>
                            <DialogTitle>Approve Organisation</DialogTitle>
                            <DialogDescription>
                              Create an admin user for this organisation to grant them access.
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={submitApproval} className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                  id="firstName"
                                  value={approvalData.firstName}
                                  onChange={(e) => setApprovalData({ ...approvalData, firstName: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                  id="lastName"
                                  value={approvalData.lastName}
                                  onChange={(e) => setApprovalData({ ...approvalData, lastName: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="username">Username</Label>
                              <Input
                                id="username"
                                value={approvalData.username}
                                onChange={(e) => setApprovalData({ ...approvalData, username: e.target.value })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="email">Email</Label>
                              <Input
                                id="email"
                                type="email"
                                value={approvalData.email}
                                onChange={(e) => setApprovalData({ ...approvalData, email: e.target.value })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="password">Password</Label>
                              <Input
                                id="password"
                                type="text" // Visible so admin can copy/see it
                                value={approvalData.password}
                                onChange={(e) => setApprovalData({ ...approvalData, password: e.target.value })}
                                placeholder="Enter password"
                                required
                              />
                              <p className="text-xs text-muted-foreground">
                                Enter a secure password for the user.
                              </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                              <Button type="button" className="cursor-pointer" variant="outline" onClick={() => setApprovalModalOpen(false)}>Cancel</Button>
                              <Button className="cursor-pointer" type="submit">Approve & Create User</Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>

                      {/* Pagination Controls */}
                      <div className="flex items-center justify-between px-4 py-4 border-t bg-slate-50/30">
                        <div className="text-sm text-muted-foreground">
                          Showing {1 + ((pageNumber - 1) * pageSize)} to {Math.min(pageNumber * pageSize, totalCount)} of {totalCount} entries
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium">
                            Page {pageNumber} of {Math.ceil(totalCount / pageSize)}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline" className="cursor-pointer"
                              size="sm"
                              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                              disabled={pageNumber === 1}
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Previous
                            </Button>
                            <Button
                              variant="outline" className="cursor-pointer"
                              size="sm"
                              onClick={() => setPageNumber(p => p + 1)}
                              disabled={pageNumber >= Math.ceil(totalCount / pageSize)}
                            >
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>

                    </CardContent>
                  </>
                )}
              </Card>
            </TabsContent>
            {/* Enquiry */}
            <TabsContent value="enquiry" className="m-0 focus-visible:outline-none">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Enquiry Management</h2>
                  <p className="text-muted-foreground">Review and convert leads from sign-up enquiries.</p>
                </div>

              </div>
              <Card className="border shadow-sm">
                {/* Filter Section */}
                <div className="p-4 border-b bg-slate-50/50">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="md:col-span-2">
                      < Label htmlFor="enquiry-search" className="text-sm font-medium mb-2 block" >
                        Search Enquiries
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                        <Input
                          id="enquiry-search"
                          placeholder="Search by name, email, or organisation..."
                          value={enquirySearch}
                          onChange={(e) => setEnquirySearch(e.target.value)}
                          className="pl-9 "
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="date-from" className="text-sm font-medium mb-2 block">
                        From Date
                      </Label>
                      <Input
                        id="date-from"
                        type="date"
                        value={dateFrom}
                        className="md:w-auto"
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="date-to" className="text-sm font-medium mb-2 block">
                        To Date
                      </Label>
                      <Input
                        id="date-to"
                        type="date"
                        value={dateTo}
                        className="md:w-auto"
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportEnquiriesToCSV}
                      className="gap-2 text-white cursor-pointer bg-red-500 md:ms-auto"
                    >
                      <Download className="size-4" />
                      Export to CSV
                    </Button>
                  </div>
                  {(enquirySearch || dateFrom || dateTo) && (
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEnquirySearch("");
                          setDateFrom("");
                          setDateTo("");
                        }}
                        className="h-8 text-xs cursor-pointer"
                      >
                        Clear Filters
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Showing {filteredEnquiries.length} of {enquiries.length} enquiries
                      </span>
                    </div>
                  )}
                </div>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-semibold text-slate-700">Business Name</TableHead>
                        <TableHead className="font-semibold text-slate-700">Name</TableHead>
                        <TableHead className="font-semibold text-slate-700">Email</TableHead>
                        <TableHead className="font-semibold text-slate-700">Phone</TableHead>
                        <TableHead className="font-semibold text-slate-700">Enquiry</TableHead>
                        <TableHead className="font-semibold text-slate-700">Location</TableHead>
                        <TableHead className="font-semibold text-slate-700">Created</TableHead>
                        <TableHead className="font-semibold text-slate-700">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center">
                            <div className="flex justify-center items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              Loading enquiries...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredEnquiries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                            {enquiries.length === 0 ? "No enquiries found." : "No enquiries match your filters."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEnquiries.map((enq) => (
                          <TableRow key={enq.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium">{enq.organisationName || 'N/A'}</TableCell>
                            <TableCell>{enq.name || 'N/A'}</TableCell>
                            <TableCell>{enq.email}</TableCell>
                            <TableCell>{enq.phone || enq.mobile || 'N/A'}</TableCell>
                            <TableCell>
                              {enq.enquiryText ? (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 cursor-pointer px-3 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300">
                                      View Details
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-3xl">
                                    <DialogHeader>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                          New Enquiry
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">{new Date(enq.createdAt).toLocaleString()}</span>
                                      </div>
                                      <DialogTitle className="text-2xl">Enquiry Details</DialogTitle>
                                      <DialogDescription>
                                        Details submitted by {enq.name} from {enq.organisationName}
                                      </DialogDescription>
                                    </DialogHeader>

                                    <div className="grid gap-6 py-4">
                                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact Person</p>
                                          <p className="font-medium text-lg">{enq.name || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Address</p>
                                          <p className="font-medium">{enq.email}</p>
                                        </div>
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone Number</p>
                                          <p className="font-medium">{enq.phone || enq.mobile || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Name</p>
                                          <p className="font-medium">{enq.organisationName || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</p>
                                          <p className="font-medium">{[enq.city, enq.state, enq.country].filter(Boolean).join(", ") || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tax / VAT Number</p>
                                          <p className="font-medium">{enq.taxNumber || 'N/A'}</p>
                                        </div>
                                      </div>

                                      <div className="space-y-2 bg-slate-50 p-6 rounded-lg border">
                                        <div className="flex items-center gap-2 mb-2">
                                          <MessageSquare className="size-4 text-muted-foreground" />
                                          <p className="text-sm font-semibold text-slate-700">Enquiry Message</p>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                          {enq.enquiryText}
                                        </p>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              ) : (
                                <span className="text-muted-foreground text-sm">No message</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {enq.city}, {enq.state}, {enq.country}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(enq.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {enq.isConverted ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 cursor-pointer bg-green-50 text-green-700 border-green-200 cursor-not-allowed"
                                  disabled
                                >
                                  <CheckCircle className="mr-1 size-3" />
                                  Organisation Created
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 cursor-pointer hover:bg-primary/10"
                                  onClick={() => handleConvertToOrg(enq)}
                                >
                                  Create Organisation
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. Platform Configuration */}
            {/* 3. Platform Configuration */}
            <TabsContent value="platform" className="m-0 focus-visible:outline-none">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Platform Configuration</h2>
                <p className="text-muted-foreground">Manage global API keys and secrets.</p>
              </div>
              <Card className="border shadow-sm">
                <CardContent className="p-6">
                  {!selectedPlatform ? (
                    <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-4">
                      {[
                        { name: "Facebook", platform: "FACEBOOK", icon: Facebook },
                        { name: "Instagram", platform: "INSTAGRAM", icon: Instagram },
                        { name: "LinkedIn", platform: "LINKEDIN", icon: Linkedin },
                        { name: "YouTube", platform: "YOUTUBE", icon: Youtube },
                        { name: "Pinterest", platform: "PINTEREST", icon: Settings },
                        { name: "WhatsApp", platform: "WHATSAPP", icon: MessageSquare },
                        { name: "SMS", platform: "SMS", icon: Smartphone },
                        { name: "Email", platform: "EMAIL", icon: Mail }
                      ].map((p) => (
                        <Button
                          key={p.platform}
                          variant="outline"
                          className="h-24 flex flex-col items-center cursor-pointer justify-center gap-2 hover:border-primary hover:bg-primary/5"
                          onClick={() => setSelectedPlatform(p.platform)}
                        >
                          <p.icon className="size-8 text-muted-foreground" />
                          <span className="font-semibold">{p.name}</span>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <Button variant="ghost" className="cursor-pointer" size="sm" onClick={() => setSelectedPlatform(null)}>
                          <ArrowLeft className="mr-2 size-4" /> Back
                        </Button>
                        <h3 className="text-lg font-semibold">
                          {[
                            { name: "Facebook", platform: "FACEBOOK" },
                            { name: "Instagram", platform: "INSTAGRAM" },
                            { name: "LinkedIn", platform: "LINKEDIN" },
                            { name: "YouTube", platform: "YOUTUBE" },
                            { name: "Pinterest", platform: "PINTEREST" },
                            { name: "WhatsApp", platform: "WHATSAPP" },
                            { name: "SMS", platform: "SMS" },
                            { name: "Email", platform: "EMAIL" }
                          ].find(p => p.platform === selectedPlatform)?.name}
                        </h3>
                      </div>

                      <div className="grid gap-6 max-w-2xl">
                        {[
                          {
                            platform: "FACEBOOK",
                            keys: [
                              { key: "FACEBOOK_CLIENT_ID", label: "App ID" },
                              { key: "FACEBOOK_CLIENT_SECRET", label: "App Secret" }
                            ]
                          },
                          {
                            platform: "INSTAGRAM",
                            keys: [
                              { key: "INSTAGRAM_CLIENT_ID", label: "OAuth App ID" },
                              { key: "INSTAGRAM_CLIENT_SECRET", label: "OAuth App Secret" },
                              { key: "INSTAGRAM_DIRECT_ID", label: "Direct Login ID (for direct Instagram auth)" },
                              { key: "INSTAGRAM_DIRECT_SECRET", label: "Direct Login Secret (for direct Instagram auth)" }
                            ]
                          },
                          {
                            platform: "LINKEDIN",
                            keys: [
                              { key: "LINKEDIN_CLIENT_ID", label: "Client ID" },
                              { key: "LINKEDIN_CLIENT_SECRET", label: "Client Secret" }
                            ]
                          },
                          {
                            platform: "YOUTUBE",
                            keys: [
                              { key: "YOUTUBE_CLIENT_ID", label: "Client ID" },
                              { key: "YOUTUBE_CLIENT_SECRET", label: "Client Secret" }
                            ]
                          },
                          {
                            platform: "PINTEREST",
                            keys: [
                              { key: "PINTEREST_CLIENT_ID", label: "App ID" },
                              { key: "PINTEREST_CLIENT_SECRET", label: "Client Secret" }
                            ]
                          },
                          {
                            platform: "WHATSAPP",
                            keys: [
                              { key: "WHATSAPP_ACCOUNT_SID", label: "Account SID" },
                              { key: "WHATSAPP_AUTH_TOKEN", label: "Auth Token" },
                              { key: "WHATSAPP_NUMBER", label: "WhatsApp Number" }
                            ]
                          },
                          {
                            platform: "SMS",
                            keys: [
                              { key: "SMS_ACCOUNT_SID", label: "Account SID" },
                              { key: "SMS_AUTH_TOKEN", label: "Auth Token" },
                              { key: "SMS_NUMBER", label: "Twilio Number" }
                            ]
                          },
                          {
                            platform: "EMAIL",
                            keys: [
                              { key: "MAILGUN_API_KEY", label: "Mailgun API Key" },
                              { key: "MAILGUN_DOMAIN", label: "Mailgun Domain" },
                              { key: "MAILGUN_FROM_EMAIL", label: "From Email" }
                            ]
                          },

                        ].find(p => p.platform === selectedPlatform)?.keys.map((item) => {
                          const config = platformConfigs.find(c => c.key === item.key);
                          return (
                            <div key={item.key} className="grid gap-2">
                              <Label htmlFor={`input-${item.key}`}>{item.label}</Label>
                              <div className="relative">
                                <SecretInput
                                  defaultValue={config?.value || ''}
                                  placeholder={`Enter ${item.label}`}

                                  id={`input-${item.key}`}
                                  onBlur={(e) => handleUpdateConfig(item.key, e.target.value, selectedPlatform)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 4. System Administration */}
            <TabsContent value="system" className="m-0 space-y-4 focus-visible:outline-none">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">System Settings</h2>
              </div>
              <div className="">
                {/* <Card className="border shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Job Settings</CardTitle>
                        <CardDescription>Configure background jobs.</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 cursor-pointer"
                        onClick={() => setActiveTab("scheduler")}
                      >
                        Manage Automation & Scheduler
                        <ExternalLink className="size-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {['POST_SCHEDULER', 'ANALYTICS_SYNC', 'BILLING_CYCLE'].map((job) => {
                      const setting = jobSettings.find(j => j.jobName === job);
                      return (
                        <div key={job} className="flex items-center justify-between border-b pb-4 last:border-0">
                          <div>
                            <p className="font-medium">{job}</p>
                            <p className="text-sm text-muted-foreground">Frequency: {setting?.frequency || '5m'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={setting?.isEnabled ?? true}
                              onCheckedChange={(checked) => handleUpdateJob(job, setting?.frequency || '5m', checked)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card> */}

                <AdminBroadcastNotification />
              </div>
            </TabsContent>

            {/* Scheduler Management */}
            <TabsContent value="scheduler" className="m-0 focus-visible:outline-none">
              <AdminSchedulerView />
            </TabsContent>

            {/* 4. Billing Plans */}
            <TabsContent value="billing-plans" className="m-0 focus-visible:outline-none">
              {!isEditingPlan ? (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Billing Plans</h2>
                      <p className="text-muted-foreground">Manage subscription plans and pricing</p>
                    </div>

                  </div>

                  {/* Search and Filter */}
                  <Card className="border border-1 l shadow-sm mb-4">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row justify-between ">
                        <div className="flex">

                          <div className="">
                            <Input
                              placeholder="Search plans..."
                              value={plansSearch}
                              className="w-auto"
                              onChange={(e) => setPlansSearch(e.target.value)}
                            />
                          </div>
                          <div className="border mx-2 border-1 rounded-md">

                            <Select value={plansStatusFilter} onValueChange={setPlansStatusFilter}>
                              <SelectTrigger className="w-auto border rounded">
                                <SelectValue placeholder="Filter by status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Plans</SelectItem>
                                <SelectItem value="active">Active Only</SelectItem>
                                <SelectItem value="inactive">Inactive Only</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>

                          <Button className="cursor-pointer" onClick={handleCreatePlanClick}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Plan
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Plans Table */}
                  <Card className="border shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Plan Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Billing Cycle</TableHead>
                          <TableHead>Subscriptions</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billingPlans
                          .filter(plan => {
                            const matchesSearch = !plansSearch ||
                              plan.name.toLowerCase().includes(plansSearch.toLowerCase()) ||
                              plan.description?.toLowerCase().includes(plansSearch.toLowerCase());
                            const matchesStatus = plansStatusFilter === 'all' ||
                              (plansStatusFilter === 'active' && plan.isActive) ||
                              (plansStatusFilter === 'inactive' && !plan.isActive);
                            return matchesSearch && matchesStatus;
                          })
                          .map((plan: any) => (
                            <TableRow key={plan.id}>
                              <TableCell className="font-medium">{plan.name}</TableCell>
                              <TableCell className="max-w-xs truncate">
                                {plan.description || "-"}
                              </TableCell>
                              <TableCell>₹{Number(plan.price).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{plan.billingCycle}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">{plan.activeSubscriptions || 0}</span>
                                  <span className="text-xs text-muted-foreground">
                                    of {plan.totalSubscriptions || 0} total
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={plan.isActive ? "default" : "secondary"}>
                                  {plan.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    className="h-8 px-2 cursor-pointer bg-indigo-500 hover:text-white text-white hover:bg-indigo-600"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditPlanClick(plan)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-red-600  text-white hover:bg-red-500 cursor-pointer"
                                    onClick={() => handleDeletePlanClick(plan)}
                                  >
                                    <Trash className="h-4 text-white   w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        {billingPlans.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No billing plans found. Click "Create Plan" to add one.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Card>
                </>
              ) : (
                <>
                  {/* Billing Plan Form */}
                  <div className="mb-6">
                    <Button
                      variant="ghost"
                      onClick={handleCancelPlanForm}
                      className="mb-4 cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Plans
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                      {editingPlanId ? 'Edit Plan' : 'Create New Plan'}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      {editingPlanId ? 'Update billing plan details' : 'Add a new billing plan for subscriptions'}
                    </p>
                  </div>

                  {/* Active Subscriptions Warning */}
                  {hasActiveSubscriptions && editingPlanId && (
                    <Card className="mb-6 border-yellow-500 bg-yellow-50">
                      <CardContent className="p-4 flex items-start gap-3">
                        <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800">
                            This plan has active subscriptions.
                          </p>
                          <p className="text-sm text-yellow-700 mt-1">
                            Price and billing cycle cannot be changed. Create a new plan if you need different pricing.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Form */}
                  <form onSubmit={handleSubmitPlan}>
                    <Card>
                      <CardHeader>
                        <CardTitle>Plan Details</CardTitle>
                        <CardDescription>
                          {editingPlanId ? 'Update the details for this billing plan' : 'Enter the details for the new billing plan'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Plan Name */}
                        <div className="space-y-2">
                          <Label htmlFor="planName">
                            Plan Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="planName"
                            value={planFormData.name}
                            onChange={(e) => {
                              setPlanFormData({ ...planFormData, name: e.target.value });
                              if (planErrors.name) setPlanErrors({ ...planErrors, name: "" });
                            }}
                            placeholder="e.g., Premium Plan"
                            className={planErrors.name ? "border-red-500" : ""}
                          />
                          {planErrors.name && (
                            <p className="text-sm text-red-500">{planErrors.name}</p>
                          )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                          <Label htmlFor="planDescription">Description</Label>
                          <Textarea
                            id="planDescription"
                            value={planFormData.description}
                            onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                            placeholder="Describe the plan benefits..."
                            className="border border-1 rounded-md border-gray-300"
                            rows={3}
                          />
                        </div>

                        {/* Price and Billing Cycle */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="planPrice">
                              Price (₹) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="planPrice"
                              type="number"
                              step="0.01"
                              min="0"
                              value={planFormData.price}
                              onChange={(e) => {
                                setPlanFormData({ ...planFormData, price: e.target.value });
                                if (planErrors.price) setPlanErrors({ ...planErrors, price: "" });
                              }}
                              placeholder="999.00"
                              disabled={hasActiveSubscriptions && !!editingPlanId}
                              className={planErrors.price ? "border-red-500" : ""}
                            />
                            {planErrors.price && (
                              <p className="text-sm text-red-500">{planErrors.price}</p>
                            )}
                            {hasActiveSubscriptions && editingPlanId && (
                              <p className="text-xs text-muted-foreground">
                                Cannot be changed (plan has active subscriptions)
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="planBillingCycle">
                              Billing Cycle <span className="text-red-500">*</span>
                            </Label>
                            <div className="border border-1 rounded-md border-gray-300">

                              <Select

                                value={planFormData.billingCycle}
                                onValueChange={(value) => setPlanFormData({ ...planFormData, billingCycle: value })}
                                disabled={hasActiveSubscriptions && !!editingPlanId}
                              >
                                <SelectTrigger id="planBillingCycle">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                                  <SelectItem value="YEARLY">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {hasActiveSubscriptions && editingPlanId && (
                              <p className="text-xs text-muted-foreground">
                                Cannot be changed (plan has active subscriptions)
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Features */}
                        <div className="space-y-2">
                          <div className="flex items-center  justify-between">
                            <Label>
                              Features <span className="text-red-500">*</span>
                            </Label>
                            <Button
                              className="text-white cursor-pointer bg-red-500"
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleAddPlanFeature}
                            >
                              <Plus className="h-4 text-white w-4 mr-1" />
                              Add Feature
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {planFeatures.map((feature, index) => (
                              <div key={index} className="flex gap-2">
                                <Input
                                  value={feature}
                                  onChange={(e) => handlePlanFeatureChange(index, e.target.value)}
                                  placeholder={`Feature ${index + 1}`}
                                  className={planErrors.features && !feature.trim() ? "border-red-500" : ""}
                                />
                                {planFeatures.length > 1 && (
                                  <Button
                                    type="button" className="cursor-pointer"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemovePlanFeature(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                          {planErrors.features && (
                            <p className="text-sm text-red-500">{planErrors.features}</p>
                          )}
                        </div>

                        {/* Settings */}
                        <div className="space-y-4 pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="planIsActive">Active Status</Label>
                              <p className="text-sm text-muted-foreground">
                                Make this plan available for subscriptions
                              </p>
                            </div>
                            <Switch
                              id="planIsActive"
                              checked={planFormData.isActive}
                              onCheckedChange={(checked) =>
                                setPlanFormData({ ...planFormData, isActive: checked })
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="planAutoRenew">Auto Renew</Label>
                              <p className="text-sm text-muted-foreground">
                                Automatically renew subscriptions
                              </p>
                            </div>
                            <Switch
                              id="planAutoRenew"
                              checked={planFormData.autoRenew}
                              onCheckedChange={(checked) =>
                                setPlanFormData({ ...planFormData, autoRenew: checked })
                              }
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-end gap-4 mt-6">
                      <Button
                        type="button"
                        className="cursor-pointer"
                        variant="outline"
                        onClick={handleCancelPlanForm}
                        disabled={isSavingPlan}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSavingPlan} className="cursor-pointer">
                        {isSavingPlan ? "Saving..." : (editingPlanId ? "Save Changes" : "Create Plan")}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </TabsContent>

            {/* Delete Plan Modal */}
            <Dialog open={!!deletingPlan} onOpenChange={(open) => !open && handleCancelDelete()}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {affectedOrganisations.length > 0 ? 'Migrate and Delete Plan' : 'Delete Plan'}
                  </DialogTitle>
                  <DialogDescription>
                    {affectedOrganisations.length > 0
                      ? 'This plan has active subscriptions. You must migrate users to another plan before deletion.'
                      : 'Are you sure you want to delete this plan?'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Plan Info */}
                  {deletingPlan && (
                    <Card className="bg-muted/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{deletingPlan.name}</h4>
                            <p className="text-sm text-muted-foreground">{deletingPlan.description}</p>
                          </div>
                          <Badge variant={deletingPlan.isActive ? "default" : "secondary"}>
                            {deletingPlan.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Affected Organizations */}
                  {affectedOrganisations.length > 0 && (
                    <>
                      <div>
                        <Label className="text-base font-semibold">
                          Affected Organizations ({affectedOrganisations.length})
                        </Label>
                        <Card className="mt-2 max-h-48 overflow-y-auto">
                          <CardContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Organization</TableHead>
                                  <TableHead>Email</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {affectedOrganisations.map((org: any) => (
                                  <TableRow key={org.id}>
                                    <TableCell className="font-medium">{org.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {org.email || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Migration Plan Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="migrationPlan">
                          Migrate to Plan <span className="text-red-500">*</span>
                        </Label>
                        <Select value={selectedMigrationPlan} onValueChange={setSelectedMigrationPlan}>
                          <SelectTrigger id="migrationPlan">
                            <SelectValue placeholder="Select a plan..." />
                          </SelectTrigger>
                          <SelectContent>
                            {billingPlans
                              .filter(p => p.id !== deletingPlan?.id && p.isActive)
                              .map((plan: any) => (
                                <SelectItem key={plan.id} value={plan.id.toString()}>
                                  {plan.name} - ₹{Number(plan.price).toLocaleString()}/{plan.billingCycle}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          All {affectedOrganisations.length} subscriptions will be migrated to the selected plan
                        </p>
                      </div>

                      {/* Confirmation Checkbox */}
                      <div className="flex items-start space-x-2 border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                        <input
                          type="checkbox"
                          id="deleteConfirmation"
                          checked={deleteConfirmationChecked}
                          onChange={(e) => setDeleteConfirmationChecked(e.target.checked)}
                          className="mt-1"
                        />
                        <Label htmlFor="deleteConfirmation" className="text-sm cursor-pointer">
                          I understand that {affectedOrganisations.length} organization{affectedOrganisations.length !== 1 ? 's' : ''} will be migrated to the selected plan, and this action cannot be undone.
                        </Label>
                      </div>
                    </>
                  )}

                  {/* No Subscriptions Warning */}
                  {affectedOrganisations.length === 0 && (
                    <Card className="border-yellow-500 bg-yellow-50">
                      <CardContent className="p-4 flex items-start gap-3">
                        <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800">
                            This action will permanently delete the plan
                          </p>
                          <p className="text-sm text-yellow-700 mt-1">
                            The plan will be marked as deleted and won't be available for new subscriptions.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    className="cursor-pointer"
                    onClick={handleCancelDelete}
                    disabled={isDeletingPlan}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmDelete}
                    className="cursor-pointer"
                    disabled={isDeletingPlan}
                  >
                    {isDeletingPlan ? "Deleting..." : (affectedOrganisations.length > 0 ? "Migrate & Delete" : "Delete Plan")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>


            {/* 5. Logs */}
            <TabsContent value="logs" className="m-0 focus-visible:outline-none">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Audit Logs</h2>
                <p className="text-muted-foreground">View system activity and audit trail</p>
              </div>

              {/* Filter Controls */}
              <Card className="border shadow-sm mb-4">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Keyword Search */}
                    <div className="space-y-2">
                      <Label htmlFor="logsKeyword">Search</Label>
                      <Input
                        id="logsKeyword"
                        placeholder="Search in message..."
                        value={logsKeyword}
                        onChange={(e) => {
                          setLogsKeyword(e.target.value);
                          setLogsPage(1); // Reset to first page
                        }}
                      />
                    </div>

                    {/* Log Level Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="logsLevel">Log Level</Label>
                      <div className="border border-1 rounded-md">

                        <Select value={logsLevel} onValueChange={(value) => {
                          setLogsLevel(value);
                          setLogsPage(1);
                        }}>
                          <SelectTrigger id="logsLevel">
                            <SelectValue placeholder="All Levels" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Levels</SelectItem>
                            <SelectItem value="Info">Info</SelectItem>
                            <SelectItem value="Warning">Warning</SelectItem>
                            <SelectItem value="Error">Error</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Date From */}
                    <div className="space-y-2">
                      <Label htmlFor="logsDateFrom">Date From</Label>
                      <Input
                        id="logsDateFrom"
                        type="date"
                        value={logsDateFrom}
                        onChange={(e) => {
                          setLogsDateFrom(e.target.value);
                          setLogsPage(1);
                        }}
                      />
                    </div>

                    {/* Date To */}
                    <div className="space-y-2">
                      <Label htmlFor="logsDateTo">Date To</Label>
                      <Input
                        id="logsDateTo"
                        type="date"
                        value={logsDateTo}
                        onChange={(e) => {
                          setLogsDateTo(e.target.value);
                          setLogsPage(1);
                        }}
                      />
                    </div>
                  </div>

                  {/* Clear Filters Button */}
                  {(logsKeyword || logsLevel !== 'all' || logsDateFrom || logsDateTo) && (
                    <div className="mt-4">
                      <Button
                        className="cursor-pointer"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLogsKeyword("");
                          setLogsLevel("all");
                          setLogsDateFrom("");
                          setLogsDateTo("");
                          setLogsPage(1);
                        }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[110px]">Level</TableHead>
                          <TableHead className="max-w-[400px]">Message</TableHead>
                          <TableHead className="w-[180px]">Timestamp</TableHead>
                          <TableHead className="w-[160px]">Properties</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              No logs found
                            </TableCell>
                          </TableRow>
                        ) : (
                          logs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>
                                <Badge
                                  variant={
                                    log.level === 'Error' ? 'destructive' :
                                      log.level === 'Warning' ? 'outline' :
                                        'secondary'
                                  }
                                >
                                  {log.level}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[400px]">
                                <div
                                  className="truncate font-medium cursor-help"
                                  title={log.message || ''}
                                >
                                  {log.message}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(log.timeStamp).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {log.properties || log.exception ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="cursor-pointer h-8 gap-2"
                                    onClick={() => {
                                      setSelectedLogProperties(log.properties);
                                      setSelectedLogException(log.exception);
                                      setPropertiesModalOpen(true);
                                    }}
                                  >
                                    <FileJson className="h-4 w-4" />
                                    View Details
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {logsTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-4 border-t bg-slate-50/30">
                      <div className="text-sm text-muted-foreground">
                        Showing {1 + ((logsPage - 1) * logsPageSize)} to {Math.min(logsPage * logsPageSize, logsTotalCount)} of {logsTotalCount} entries
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">
                          Page {logsPage} of {logsTotalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            className="cursor-pointer"
                            size="sm"
                            onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                            disabled={logsPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))}
                            disabled={logsPage >= logsTotalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* JSON Properties Viewer Modal */}
              <Dialog open={propertiesModalOpen} onOpenChange={setPropertiesModalOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileJson className="h-5 w-5 text-primary" />
                      Log Properties
                    </DialogTitle>
                    <DialogDescription>
                      Detailed view of the log entry properties in JSON format
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-hidden flex flex-col gap-4">
                    {selectedLogProperties || selectedLogException ? (
                      <div className="flex-1 overflow-auto space-y-4">
                        {/* Properties Section */}
                        {selectedLogProperties && (
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <FileJson className="h-4 w-4 text-blue-600" />
                                Properties
                              </h3>
                              <Button
                                size="sm"
                                variant="outline"
                                className="cursor-pointer gap-2 h-7 text-xs"
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedLogProperties);
                                  toast.success("Properties copied to clipboard");
                                }}
                              >
                                <Download className="h-3 w-3" />
                                Copy
                              </Button>
                            </div>
                            <div className="bg-slate-950 rounded-lg p-6 font-mono text-sm overflow-x-auto">
                              <JsonViewer jsonString={selectedLogProperties} />
                            </div>
                          </div>
                        )}

                        {/* Exception Section */}
                        {selectedLogException && (
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                                <X className="h-4 w-4 text-red-600" />
                                Exception
                              </h3>
                              <Button
                                size="sm"
                                variant="outline"
                                className="cursor-pointer gap-2 h-7 text-xs border-red-300 hover:bg-red-50"
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedLogException);
                                  toast.success("Exception copied to clipboard");
                                }}
                              >
                                <Download className="h-3 w-3" />
                                Copy
                              </Button>
                            </div>
                            <div className="bg-red-950 rounded-lg p-6 font-mono text-sm overflow-x-auto border border-red-800">
                              <pre className="text-red-200 whitespace-pre-wrap break-words leading-relaxed">
                                {selectedLogException}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-40 text-muted-foreground">
                        No properties available
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setPropertiesModalOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

          </div>
        </main>
      </Tabs>
      <footer className="flex-shrink-0 border-t bg-background p-4 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} CampZeo. All rights reserved.
      </footer>
    </div>
  );
}
