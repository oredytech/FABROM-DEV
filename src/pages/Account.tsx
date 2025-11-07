import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Calendar, MessageSquare, Coins } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Profile {
  first_name?: string;
  last_name?: string;
  email: string;
  avatar_url?: string;
}

interface Credits {
  credits_remaining: number;
  subscription_active: boolean;
  last_reset_date: string;
}

interface Conversation {
  id: string;
  project_name: string;
  created_at: string;
  updated_at: string;
  messages: any;
}

const Account = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchCredits();
      fetchConversations();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return;
    }

    if (data) {
      setProfile(data);
      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
    }
  };

  const fetchCredits = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("user_credits")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error fetching credits:", error);
      return;
    }

    if (data) {
      setCredits(data);
    }
  };

  const fetchConversations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("conversation_history")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return;
    }

    if (data) {
      setConversations(data);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      toast.error("Erreur lors de la mise à jour du profil");
      console.error("Error updating profile:", error);
    } else {
      toast.success("Profil mis à jour avec succès");
      fetchProfile();
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from("conversation_history")
      .delete()
      .eq("id", conversationId);

    if (error) {
      toast.error("Erreur lors de la suppression de la conversation");
      console.error("Error deleting conversation:", error);
    } else {
      toast.success("Conversation supprimée");
      fetchConversations();
    }
  };

  const handleResetProfile = async () => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: null,
        last_name: null,
        avatar_url: null,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Erreur lors de la réinitialisation du profil");
      console.error("Error resetting profile:", error);
    } else {
      toast.success("Profil réinitialisé avec succès");
      setFirstName("");
      setLastName("");
      fetchProfile();
    }
  };

  const getDaysUntilReset = () => {
    if (!credits) return 0;
    const lastReset = new Date(credits.last_reset_date);
    const now = new Date();
    const nextReset = new Date(lastReset);
    nextReset.setDate(nextReset.getDate() + 1);
    const hoursUntilReset = Math.max(0, (nextReset.getTime() - now.getTime()) / (1000 * 60 * 60));
    return Math.ceil(hoursUntilReset);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/editor")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <h1 className="text-2xl font-bold">Mon Compte</h1>
          </div>
          <Button variant="outline" onClick={signOut}>
            Déconnexion
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informations du profil</CardTitle>
              <CardDescription>Gérez vos informations personnelles</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Votre prénom"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Votre nom"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Réinitialiser le profil</AlertDialogTitle>
                        <AlertDialogDescription>
                          Êtes-vous sûr de vouloir réinitialiser votre profil ? Cette action supprimera
                          votre prénom, nom et photo de profil.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetProfile}>
                          Réinitialiser
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Credits Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-500" />
                Crédits
              </CardTitle>
              <CardDescription>Votre solde de crédits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Crédits restants</span>
                  <span className="text-3xl font-bold text-primary">
                    {credits?.credits_remaining || 0}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Type de compte</span>
                  <span className="font-medium">
                    {credits?.subscription_active ? "Premium" : "Gratuit"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Limite mensuelle</span>
                  <span className="font-medium">40 crédits</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Réinitialisation quotidienne dans</span>
                  <span className="font-medium">{getDaysUntilReset()}h</span>
                </div>
              </div>
              <Separator />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/subscription")}
              >
                Acheter des crédits
              </Button>
            </CardContent>
          </Card>

          {/* Conversation History */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Historique des conversations
              </CardTitle>
              <CardDescription>
                {conversations.length} conversation(s) enregistrée(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune conversation enregistrée
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conversations.map((conv) => (
                      <Card key={conv.id} className="bg-muted/50">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate">{conv.project_name}</h3>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {Array.isArray(conv.messages) ? conv.messages.length : 0} messages
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(conv.updated_at).toLocaleDateString("fr-FR")}
                                </span>
                              </div>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer la conversation</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Êtes-vous sûr de vouloir supprimer cette conversation ? Cette
                                    action est irréversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteConversation(conv.id)}
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Account;
