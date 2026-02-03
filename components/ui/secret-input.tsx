import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils"; // Assuming utils exists, verified in previous step

interface SecretInputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

export function SecretInput({ className, ...props }: SecretInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={isVisible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent text-muted-foreground"
        onClick={() => setIsVisible(!isVisible)}
      >
        {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  );
}
