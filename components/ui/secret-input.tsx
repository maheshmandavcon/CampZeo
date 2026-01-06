"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

interface SecretInputProps {
  defaultValue: string;
  placeholder: string;
  id: string;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export function SecretInput({ defaultValue, placeholder, id, onBlur }: SecretInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        defaultValue={defaultValue}
        placeholder={placeholder}
        id={id}
        type={isVisible ? "text" : "password"}
        onBlur={onBlur}
        className="pr-10"
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
