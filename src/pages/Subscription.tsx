import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";

export default function Subscription() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"airtel" | "orange">("airtel");
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const handlePayment = async () => {
    if (!phoneNumber) {
      toast.error("Veuillez entrer votre numéro de téléphone");
      return;
    }

    if (!/^\+?243\d{9}$/.test(phoneNumber.replace(/\s/g, ""))) {
      toast.error("Format de numéro invalide. Utilisez le format: +243XXXXXXXXX");
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: {
          phoneNumber: phoneNumber.replace(/\s/g, ""),
          paymentMethod
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } else {
        toast.error(data.message || "Le paiement a échoué");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error instanceof Error ? error.message : "Erreur lors du paiement");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Abonnement FABROM
          </CardTitle>
          <CardDescription>
            Obtenez 200 crédits pour 10$ par mois
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-method">Méthode de paiement</Label>
            <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "airtel" | "orange")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="airtel" id="airtel" />
                <Label htmlFor="airtel" className="cursor-pointer">Airtel Money</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="orange" id="orange" />
                <Label htmlFor="orange" className="cursor-pointer">Orange Money</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Numéro de téléphone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+243 XXX XXX XXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              Format: +243 suivi de 9 chiffres
            </p>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Abonnement mensuel</span>
              <span className="font-semibold">10$</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Crédits inclus</span>
              <span className="font-semibold">200 crédits</span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg">10$</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button 
            onClick={handlePayment} 
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement en cours...
              </>
            ) : (
              "Procéder au paiement"
            )}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="w-full"
          >
            Retour
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
