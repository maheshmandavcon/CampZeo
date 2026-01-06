import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center border-red-200">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="size-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="size-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-red-700">Account Suspended</CardTitle>
          <CardDescription>
            Your organisation account has been suspended.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Access to your dashboard has been temporarily restricted due to a violation of our terms or payment issues.
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact the administrator to resolve this issue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
