import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Plus, Edit3, Trash2, Loader2,
  ArrowUp, ArrowDown, Globe, Github, MessageCircle,
  Linkedin, Twitter, Instagram, Youtube, Mail, Link2, Facebook,
  Upload, LinkIcon,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { ImageCropper } from "@/components/profile/ImageCropper";

interface SocialLinkEntry {
  platform: string;
  url: string;
}

interface TeamProfile {
  id: string;
  name: string;
  role: string;
  description: string | null;
  avatar_url: string | null;
  social_links: SocialLinkEntry[] | Record<string, string> | null;
  order_index: number;
  is_active: boolean;
}

const SOCIAL_PLATFORMS = [
  { id: "github", label: "GitHub", icon: Github },
  { id: "telegram", label: "Telegram", icon: MessageCircle },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "twitter", label: "Twitter/X", icon: Twitter },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "email", label: "Email", icon: Mail },
  { id: "website", label: "Website", icon: Globe },
  { id: "other", label: "Lainnya", icon: Link2 },
];

function getSocialIcon(platform: string) {
  const found = SOCIAL_PLATFORMS.find((p) => p.id === platform);
  return found ? found.icon : Link2;
}

function normalizeSocialLinks(raw: TeamProfile["social_links"]): SocialLinkEntry[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is SocialLinkEntry => !!item && typeof item.platform === "string" && typeof item.url === "string")
      .map((item) => ({
        platform: item.platform,
        url: item.url,
      }));
  }

  return Object.entries(raw)
    .filter(([, url]) => typeof url === "string" && url.trim())
    .map(([platform, url]) => ({
      platform,
      url: url as string,
    }));
}

interface TeamForm {
  name: string;
  role: string;
  description: string;
  avatar_url: string;
  socialLinks: SocialLinkEntry[];
  is_active: boolean;
}

const emptyForm: TeamForm = {
  name: "",
  role: "",
  description: "",
  avatar_url: "",
  socialLinks: [],
  is_active: true,
};

export function TeamManagementPanel({ adminPassword }: { adminPassword: string }) {
  const queryClient = useQueryClient();
  const { success, error: showError } = useEnhancedToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TeamForm>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [avatarTab, setAvatarTab] = useState<"link" | "upload">("link");
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin_team_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_profiles")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;

      return ((data || []) as TeamProfile[]).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: TeamForm & { id?: string }) => {
      const socialLinksPayload = data.socialLinks
        .filter((link) => link.platform && link.url.trim())
        .map((link) => ({
          platform: link.platform,
          url: link.url.trim(),
        }));

      const payload = {
        name: data.name,
        role: data.role,
        description: data.description || null,
        avatar_url: data.avatar_url || null,
        social_links: socialLinksPayload,
        is_active: data.is_active,
      };

      if (data.id) {
        const { data: result, error } = await supabase
          .from("team_profiles")
          .update(payload)
          .eq("id", data.id)
          .select();
        if (error) throw new Error(`Update gagal: ${error.message} (code: ${error.code})`);
        if (!result || result.length === 0) {
          throw new Error("Update gagal: RLS memblokir. Pastikan SQL dari docs/TEAM_PROFILES_SETUP.sql sudah dijalankan.");
        }
        return result;
      } else {
        const maxOrder = profiles.length > 0 ? Math.max(...profiles.map(p => p.order_index)) + 1 : 0;
        const { data: result, error } = await supabase
          .from("team_profiles")
          .insert({ ...payload, order_index: maxOrder })
          .select();
        if (error) throw new Error(`Insert gagal: ${error.message} (code: ${error.code})`);
        if (!result || result.length === 0) {
          throw new Error("Insert gagal: RLS memblokir. Pastikan SQL dari docs/TEAM_PROFILES_SETUP.sql sudah dijalankan.");
        }
        return result;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin_team_profiles"] });
      queryClient.invalidateQueries({ queryKey: ["team_profiles"] });
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
      setCropperImage(null);
      success(variables.id ? "Profil berhasil diperbarui" : "Anggota tim berhasil ditambahkan");
    },
    onError: (err: any) => {
      console.error("[TeamManagement] Save error:", err);
      showError("Gagal menyimpan", err.message || "Terjadi kesalahan");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_profiles").delete().eq("id", id);
      if (error) throw new Error(`Delete gagal: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_team_profiles"] });
      queryClient.invalidateQueries({ queryKey: ["team_profiles"] });
      setDeleteConfirmId(null);
      success("Anggota tim dihapus");
    },
    onError: (err: any) => showError("Gagal menghapus", err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const idx = profiles.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error("Profil tidak ditemukan");

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= profiles.length) return;

      const reordered = [...profiles];
      [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

      const updates = reordered.map((profile, orderIndex) => ({
        id: profile.id,
        order_index: orderIndex,
      }));

      const results = await Promise.all(
        updates.map(({ id: profileId, order_index }) =>
          supabase
            .from("team_profiles")
            .update({ order_index })
            .eq("id", profileId)
            .select("id")
        )
      );

      results.forEach(({ data, error }, index) => {
        if (error) {
          throw new Error(`Reorder gagal (${updates[index].id}): ${error.message}`);
        }
        if (!data || data.length === 0) {
          throw new Error("Reorder gagal: perubahan tidak tersimpan. Periksa RLS UPDATE di team_profiles.");
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_team_profiles"] });
      queryClient.invalidateQueries({ queryKey: ["team_profiles"] });
      success("Urutan tim berhasil disimpan");
    },
    onError: (err: any) => {
      console.error("[TeamManagement] Reorder error:", err);
      showError("Gagal mengubah urutan", err.message || "Terjadi kesalahan");
    },
  });

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setCropperImage(null);
    setAvatarTab("link");
    setDialogOpen(true);
  };

  const openEdit = (profile: TeamProfile) => {
    setEditId(profile.id);
    const links = normalizeSocialLinks(profile.social_links);
    setForm({
      name: profile.name,
      role: profile.role,
      description: profile.description || "",
      avatar_url: profile.avatar_url || "",
      socialLinks: links.length > 0 ? links : [],
      is_active: profile.is_active,
    });
    setCropperImage(null);
    setAvatarTab(profile.avatar_url ? "link" : "link");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.role.trim()) {
      showError("Validasi", "Nama dan role wajib diisi");
      return;
    }
    saveMutation.mutate({ ...form, id: editId || undefined });
  };

  // Social link CRUD + reorder
  const addSocialLink = () => {
    setForm(f => ({ ...f, socialLinks: [...f.socialLinks, { platform: "github", url: "" }] }));
  };
  const removeSocialLink = (index: number) => {
    setForm(f => ({ ...f, socialLinks: f.socialLinks.filter((_, i) => i !== index) }));
  };
  const updateSocialLink = (index: number, field: "platform" | "url", value: string) => {
    setForm(f => ({
      ...f,
      socialLinks: f.socialLinks.map((link, i) => i === index ? { ...link, [field]: value } : link),
    }));
  };
  const moveSocialLink = (index: number, direction: "up" | "down") => {
    setForm(f => {
      const links = [...f.socialLinks];
      const swapIdx = direction === "up" ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= links.length) return f;
      [links[index], links[swapIdx]] = [links[swapIdx], links[index]];
      return { ...f, socialLinks: links };
    });
  };

  // Photo upload handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Format tidak didukung", "Pilih file gambar (JPG, PNG, dll)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("Ukuran terlalu besar", "Maksimal 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropperImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropComplete = async (blob: Blob) => {
    setUploadingAvatar(true);
    try {
      const fileName = `team_${editId || "new"}_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("team-avatars")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

      if (error) {
        throw new Error(`Upload gagal: ${error.message}. Pastikan bucket 'team-avatars' sudah dibuat (lihat docs/TEAM_PROFILES_SETUP.sql).`);
      }

      const { data: urlData } = supabase.storage.from("team-avatars").getPublicUrl(data.path);
      setForm(f => ({ ...f, avatar_url: urlData.publicUrl }));
      setCropperImage(null);
      success("Foto berhasil diupload");
    } catch (err: any) {
      showError("Upload gagal", err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-primary" />
              Tim Pengembang
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Kelola data tim pengembang yang ditampilkan di halaman Tentang
            </CardDescription>
          </div>
          <Button size="sm" onClick={openAdd} className="gap-1.5 text-xs h-9">
            <Plus className="w-3.5 h-3.5" /> Tambah
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Belum ada data tim pengembang
          </div>
        ) : (
          profiles.map((profile, idx) => (
            <div key={profile.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 group">
              <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => reorderMutation.mutate({ id: profile.id, direction: "up" })}
                    disabled={idx === 0 || reorderMutation.isPending}
                    className="p-1 rounded hover:bg-muted disabled:opacity-20 min-h-[28px] min-w-[28px] flex items-center justify-center"
                  >
                  <ArrowUp className="w-3 h-3" />
                </button>
                  <button
                    onClick={() => reorderMutation.mutate({ id: profile.id, direction: "down" })}
                    disabled={idx === profiles.length - 1 || reorderMutation.isPending}
                    className="p-1 rounded hover:bg-muted disabled:opacity-20 min-h-[28px] min-w-[28px] flex items-center justify-center"
                  >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              <Avatar className="w-10 h-10 shrink-0">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.name} />
                <AvatarFallback className="text-xs bg-primary/10">{getInitials(profile.name)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate">{profile.name}</span>
                  {!profile.is_active && (
                    <Badge variant="secondary" className="text-[8px] px-1">Nonaktif</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{profile.role}</span>
                {normalizeSocialLinks(profile.social_links).length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {normalizeSocialLinks(profile.social_links).map((link, socialIndex) => {
                      const Icon = getSocialIcon(link.platform);
                      return (
                        <a
                          key={`${link.platform}-${socialIndex}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          title={link.platform}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Icon className="w-3 h-3" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(profile)}>
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirmId(profile.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Anggota Tim" : "Tambah Anggota Tim"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nama lengkap" />
            </div>
            <div className="space-y-2">
              <Label>Role / Jabatan <span className="text-destructive">*</span></Label>
              <Input value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Contoh: Founder & Developer" />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Deskripsi singkat..." />
            </div>

            {/* Avatar: Link or Upload */}
            <div className="space-y-2">
              <Label>Foto Profil</Label>
              <Tabs value={avatarTab} onValueChange={(v) => setAvatarTab(v as "link" | "upload")} className="w-full">
                <TabsList className="w-full grid grid-cols-2 h-9">
                  <TabsTrigger value="link" className="text-xs gap-1.5">
                    <LinkIcon className="w-3 h-3" /> Link URL
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="text-xs gap-1.5">
                    <Upload className="w-3 h-3" /> Upload
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="link" className="space-y-2 mt-2">
                  <Input value={form.avatar_url} onChange={(e) => setForm(f => ({ ...f, avatar_url: e.target.value }))} placeholder="https://..." />
                </TabsContent>
                <TabsContent value="upload" className="space-y-3 mt-2">
                  {cropperImage ? (
                    <div className="space-y-2">
                      {uploadingAvatar && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          <span className="ml-2 text-xs text-muted-foreground">Mengupload...</span>
                        </div>
                      )}
                      {!uploadingAvatar && (
                        <ImageCropper
                          imageSrc={cropperImage}
                          onCropComplete={handleCropComplete}
                          onCancel={() => setCropperImage(null)}
                        />
                      )}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-20 border-dashed gap-2 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <div className="text-center">
                        <p className="font-medium">Pilih Foto</p>
                        <p className="text-[10px] text-muted-foreground">JPG, PNG · Max 5MB</p>
                      </div>
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
              {form.avatar_url && (
                <div className="flex items-center gap-2 mt-1">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={form.avatar_url} />
                    <AvatarFallback>?</AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] text-muted-foreground">Preview</span>
                </div>
              )}
            </div>

            {/* Social Links with reorder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Social Links</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSocialLink} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Tambah
                </Button>
              </div>
              {form.socialLinks.length === 0 && (
                <p className="text-xs text-muted-foreground">Belum ada social link. Klik "Tambah" untuk menambahkan.</p>
              )}
              <div className="space-y-2">
                {form.socialLinks.map((link, i) => {
                  const Icon = getSocialIcon(link.platform);
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-0 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveSocialLink(i, "up")}
                          disabled={i === 0}
                          className="p-0.5 rounded hover:bg-muted disabled:opacity-20 min-h-[20px] min-w-[20px] flex items-center justify-center"
                        >
                          <ArrowUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSocialLink(i, "down")}
                          disabled={i === form.socialLinks.length - 1}
                          className="p-0.5 rounded hover:bg-muted disabled:opacity-20 min-h-[20px] min-w-[20px] flex items-center justify-center"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      <Select value={link.platform} onValueChange={(v) => updateSocialLink(i, "platform", v)}>
                        <SelectTrigger className="w-[110px] h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SOCIAL_PLATFORMS.map(p => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              <div className="flex items-center gap-2">
                                <p.icon className="w-3 h-3" />
                                {p.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={link.url}
                        onChange={(e) => updateSocialLink(i, "url", e.target.value)}
                        placeholder="https://..."
                        className="flex-1 h-9 text-xs"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeSocialLink(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Aktif</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editId ? "Perbarui" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Anggota Tim?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Data akan dihapus permanen dari halaman Tentang.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
