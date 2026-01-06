"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Eye,
  Trash2,
  Mail,
  MessageSquare,
  Phone,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Filter,
  Pin,
} from "lucide-react";
import TemplatePreview from "./_components/TemplatePreview";



interface MessageTemplate {
  id: number;
  name: string;
  description: string | null;
  content: string;
  subject: string | null;
  platform: string;
  category: string;
  variables: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  mediaUrls?: string[];
}

const platformIcons: Record<string, any> = {
  EMAIL: Mail,
  SMS: MessageSquare,
  WHATSAPP: Phone,
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  LINKEDIN: Linkedin,
  YOUTUBE: Youtube,
  PINTEREST: Pin,
};

const platformColors: Record<string, string> = {
  EMAIL: "bg-blue-500",
  SMS: "bg-green-500",
  WHATSAPP: "bg-emerald-500",
  FACEBOOK: "bg-blue-600",
  INSTAGRAM: "bg-pink-500",
  LINKEDIN: "bg-blue-700",
  YOUTUBE: "bg-red-500",
  PINTEREST: "bg-red-600",
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Modals
  const [deleteTemplate, setDeleteTemplate] = useState<MessageTemplate | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchQuery, platformFilter, categoryFilter]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/templates");
      const data = await response.json();

      if (data.success) {
        setTemplates(data.data);
      } else {
        toast.error("Failed to load templates");
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    // Platform filter
    if (platformFilter !== "ALL") {
      filtered = filtered.filter((t: any) => t.platform === platformFilter);
    }

    // Category filter
    if (categoryFilter !== "ALL") {
      filtered = filtered.filter((t: any) => t.category === categoryFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.content.toLowerCase().includes(query)
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;

    try {
      const response = await fetch(`/api/templates/${deleteTemplate.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Template deleted successfully");
        setDeleteTemplate(null);
        fetchTemplates();
      } else {
        toast.error(data.error || "Failed to delete template");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  const getPlatformIcon = (platform: string) => {
    const Icon = platformIcons[platform] || Mail;
    return <Icon className="size-5" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className=" mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Message Templates</h1>
            <p className="text-muted-foreground">
              Create and manage reusable message templates
            </p>
          </div>
          <Button onClick={() => router.push("/organisation/templates/new")}>
            <Plus className="mr-2 size-4" />
            New Template
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute  size-4 text-muted-foreground" style={{ top: "10px", left: "10px" }} />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
<div className="border rounded-md">
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Platforms</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="FACEBOOK">Facebook</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                  <SelectItem value="YOUTUBE">YouTube</SelectItem>
                  <SelectItem value="PINTEREST">Pinterest</SelectItem>
                </SelectContent>
              </Select>
</div>
<div className="border rounded-md">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="TRANSACTIONAL">Transactional</SelectItem>
                  <SelectItem value="NOTIFICATION">Notification</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select></div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Filter className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No templates found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery || platformFilter !== "ALL" || categoryFilter !== "ALL"
                  ? "Try adjusting your filters"
                  : "Create your first template to get started"}
              </p>
              {!searchQuery && platformFilter === "ALL" && categoryFilter === "ALL" && (
                <Button onClick={() => router.push("/organisation/templates/new")}>
                  <Plus className="mr-2 size-4" />
                  Create Template
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                {/* Template Title Header */}
                <div className="p-4 border-b bg-gray-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${platformColors[template.platform]} text-white`}>
                        {getPlatformIcon(template.platform)}
                      </div>
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{template.name}</h3>
                    </div>
                    {!template.isActive && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                  </div>
                </div>

                {/* Live Preview */}
                <div className="p-4 bg-gray-50">
                  <TemplatePreview
                    platform={template.platform}
                    content={template.content}
                    subject={template.subject}
                    mediaUrls={template.mediaUrls}
                    isCompact={true}
                  />
                </div>

                {/* Action Buttons */}
                <div className="p-4 border-t flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push(`/organisation/templates/${template.id}`)}
                  >
                    <Eye className="mr-2 size-4" />
                    View & Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTemplate(template)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}


        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteTemplate?.name}"? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
