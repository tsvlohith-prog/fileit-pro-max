import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ChangeExpirationDialogProps {
  onClose?: () => void;
}

export function ChangeExpirationDialog({ onClose }: ChangeExpirationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  
  // State for file or folder being edited
  const [target, setTarget] = useState<{
    type: "file" | "folder";
    id: string;
    name: string;
    currentExpiresAt?: string | null;
  } | null>(null);

  const [selectedDuration, setSelectedDuration] = useState<string>("259200"); // 3 days default
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleFileEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { fileId, originalName, currentExpiresAt } = customEvent.detail;
      setTarget({
        type: "file",
        id: fileId,
        name: originalName,
        currentExpiresAt,
      });
      setSelectedDuration("259200"); // Default choice to 3 days when opening
      setIsOpen(true);
    };

    const handleFolderEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { folderId, name, currentExpiresAt } = customEvent.detail;
      setTarget({
        type: "folder",
        id: folderId,
        name,
        currentExpiresAt,
      });
      setSelectedDuration("259200"); // Default choice to 3 days when opening
      setIsOpen(true);
    };

    window.addEventListener("change-file-expiration", handleFileEvent);
    window.addEventListener("change-folder-expiration", handleFolderEvent);

    return () => {
      window.removeEventListener("change-file-expiration", handleFileEvent);
      window.removeEventListener("change-folder-expiration", handleFolderEvent);
    };
  }, []);

  const handleSave = async () => {
    if (!target) return;
    setIsSaving(true);

    try {
      let expiresAt: string | null = null;
      if (selectedDuration !== "forever") {
        const seconds = parseInt(selectedDuration, 10);
        expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
      }

      const endpoint = target.type === "file" 
        ? `/api/files/${target.id}/expires` 
        : `/api/folders/${target.id}/expires`;

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresAt }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update expiration: ${response.statusText}`);
      }

      toast({
        title: "Expiration timer updated",
        description: `Successfully modified dissolution timer for "${target.name}".`,
      });

      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      
      // Specifically invalidate rooms or dynamic endpoints if any
      const activeRoomId = localStorage.getItem("fileit_active_room_id");
      if (activeRoomId) {
        queryClient.invalidateQueries({ queryKey: [`/api/rooms/${activeRoomId}`] });
      }

      setIsOpen(false);
      setTarget(null);
      if (onClose) onClose();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not update dissolution timer.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const durations = [
    { label: "1 Hour", value: "3600" },
    { label: "12 Hours", value: "43200" },
    { label: "1 Day", value: "86400" },
    { label: "3 Days (Default)", value: "259200" },
    { label: "1 Week", value: "604800" },
    { label: "30 Days", value: "2592000" },
    { label: "Keep Forever (Never)", value: "forever" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setTarget(null);
        if (onClose) onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary shrink-0" />
            <span>Modify Auto-Dissolve Timer</span>
          </DialogTitle>
          <DialogDescription>
            Configure the dissolution lifecycle for this {target?.type}. Once expired, it will dissolve itself permanently.
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="space-y-4 py-3">
            <div className="bg-secondary/40 border rounded-xl p-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Target Name</p>
              <p className="text-sm font-semibold truncate text-foreground">{target.name}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Current expiry: {target.currentExpiresAt ? new Date(target.currentExpiresAt).toLocaleString() : "Never (Keep Forever)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration-select" className="text-sm font-semibold">New Dissolve Interval</Label>
              <div className="grid grid-cols-2 gap-2">
                {durations.map((d) => (
                  <Button
                    key={d.value}
                    type="button"
                    variant={selectedDuration === d.value ? "default" : "outline"}
                    className={`h-10 text-xs justify-start px-3 py-2 font-medium ${
                      selectedDuration === d.value ? "bg-primary text-primary-foreground font-semibold" : ""
                    }`}
                    onClick={() => setSelectedDuration(d.value)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
