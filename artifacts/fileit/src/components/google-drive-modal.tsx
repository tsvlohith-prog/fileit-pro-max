import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { HardDrive, Cloud, Download, Upload, Loader2, CheckCircle2, RefreshCw, Link as LinkIcon, Search, ArrowUpRight } from "lucide-react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
};

const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0])
  : null;
const auth = app ? getAuth(app) : null;
const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/drive.readonly");

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
}

interface GoogleDriveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportFile?: (file: File) => void;
}

export function GoogleDriveModal({ open, onOpenChange, onImportFile }: GoogleDriveModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isFetchingFiles, setIsFetchingFiles] = useState(false);
  const [driveUrlInput, setDriveUrlInput] = useState("");
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    if (!auth) {
      toast({
        variant: "destructive",
        title: "Configuration Required",
        description: "Google Drive integration requires Firebase credentials to be configured in your .env file.",
      });
      return;
    }
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        toast({ title: "Connected to Google Drive", description: `Signed in as ${result.user.email}` });
        fetchDriveFiles(credential.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Sign-in failed", description: err.message || "Could not connect to Google Drive." });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDriveFiles = async (token: string) => {
    try {
      setIsFetchingFiles(true);
      const res = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,size,webViewLink)", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to list Google Drive files");
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error fetching files", description: err.message });
    } finally {
      setIsFetchingFiles(false);
    }
  };

  const handleImport = async (fileId: string, fileName: string, mimeType: string) => {
    if (!accessToken) return;
    try {
      toast({ title: "Importing from Drive", description: `Downloading ${fileName}...` });
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to download file content");
      const blob = await res.blob();
      const downloadedFile = new File([blob], fileName, { type: mimeType });
      if (onImportFile) {
        onImportFile(downloadedFile);
      }
      toast({ title: "Import Successful", description: `${fileName} imported into FileIt workspace.` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Import Failed", description: err.message });
    }
  };

  const handleUploadToDrive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;

    try {
      setIsUploadingToDrive(true);
      toast({ title: "Uploading to Google Drive", description: `Syncing ${file.name} to your Drive...` });

      const metadata = {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
      };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", file);

      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });

      if (!res.ok) throw new Error("Failed to upload file to Google Drive");

      toast({ title: "Upload Successful", description: `${file.name} successfully synced and stored in Google Drive.` });
      fetchDriveFiles(accessToken);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload to Drive Failed", description: err.message });
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const filteredDriveFiles = driveFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.mimeType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl p-6 bg-card border border-border">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Cloud className="w-6 h-6 text-primary" />
            <span>Google Drive 2-Way Sync Hub</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Connect your personal Google account to browse, search, download (import), and upload (store) files between Google Drive and Fileit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {!user || !accessToken ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 bg-secondary/30 p-6 rounded-2xl border border-border/80">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <HardDrive className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Sign in with Your Google Account</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Authenticate securely using your personal Google credentials to access your private Drive files.
                </p>
              </div>

              {/* Official Google Sign-In Button Style */}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isLoading}
                className="gsi-material-button inline-flex items-center justify-center gap-3 px-6 py-3 rounded-2xl bg-card hover:bg-secondary/80 border border-border text-foreground font-medium text-sm shadow-sm transition-all cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <>
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <span>Sign in with Google Drive</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-secondary/50 p-3 rounded-2xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-semibold text-foreground">Connected as {user.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isUploadingToDrive}
                      className="h-8 text-xs gap-1.5 rounded-xl pointer-events-none"
                    >
                      {isUploadingToDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>Upload to Drive</span>
                    </Button>
                    <input type="file" onChange={handleUploadToDrive} className="hidden" />
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => accessToken && fetchDriveFiles(accessToken)}
                    className="h-8 text-xs gap-1.5 rounded-xl"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </Button>
                </div>
              </div>

              {/* Real-time search filter for Google Drive files */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search Google Drive files by name or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Drive Files ({filteredDriveFiles.length})
                </h4>
                {isFetchingFiles ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : filteredDriveFiles.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground bg-card/40 rounded-2xl border border-border">
                    No matching files found in your Google Drive.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {filteredDriveFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/80 hover:border-primary/40 transition-all">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Cloud className="w-4 h-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{file.mimeType}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleImport(file.id, file.name, file.mimeType)}
                          className="h-7 text-xs rounded-lg gap-1 shrink-0"
                        >
                          <Download className="w-3 h-3" /> Import
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
