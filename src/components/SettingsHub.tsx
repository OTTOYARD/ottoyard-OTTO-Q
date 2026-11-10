import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShoppingCart,
  User,
  Bell,
  Shield,
  CreditCard,
  Zap,
  Database,
  Map,
  Key,
  Activity,
  Trash2,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Bot,
  Check,
  Loader2,
  Building,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CartItem } from './CartButton';
import { OrderReviewDialog } from './OrderReviewDialog';
import { InvoiceHistory } from './InvoiceHistory';
import { MonthlyStatements } from './MonthlyStatements';
import { FleetVehicles } from './FleetVehicles';
import { AccountOverview } from './AccountOverview';
import SimulatorControlPanel from './admin/SimulatorControlPanel';
import { AVSimulation } from '@/components/OttoQ/AVSimulation';
import AdminUserManagement from './admin/AdminUserManagement';

interface SettingsHubProps {
  children: React.ReactNode;
  cartItems: CartItem[];
  onRemoveFromCart: (itemId: string) => void;
  onCheckout: () => void;
}

interface UserProfile {
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  billing_email: string | null;
  notification_settings_jsonb: {
    email: boolean;
    push: boolean;
    sms: boolean;
    low_battery: boolean;
    maintenance: boolean;
    route_alerts: boolean;
    energy_thresholds: boolean;
    digest_frequency: string;
  };
  fleet_settings_jsonb: {
    battery_threshold: number;
    maintenance_interval_days: number;
    default_depot_capacity_kwh: number;
  };
  ai_preferences_jsonb: {
    model: string;
    features: {
      predictive_maintenance: boolean;
      smart_routing: boolean;
      auto_recommendations: boolean;
    };
  };
}

const defaultProfile: UserProfile = {
  full_name: null,
  company_name: null,
  phone: null,
  billing_email: null,
  notification_settings_jsonb: {
    email: true,
    push: true,
    sms: false,
    low_battery: true,
    maintenance: true,
    route_alerts: false,
    energy_thresholds: true,
    digest_frequency: 'daily',
  },
  fleet_settings_jsonb: {
    battery_threshold: 20,
    maintenance_interval_days: 30,
    default_depot_capacity_kwh: 5000,
  },
  ai_preferences_jsonb: {
    model: 'claude',
    features: {
      predictive_maintenance: true,
      smart_routing: true,
      auto_recommendations: true,
    },
  },
};

function AdminGatedContent() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');

  if (!unlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Shield className="h-5 w-5 mr-2 text-primary" />
            Admin Access
          </CardTitle>
          <CardDescription>Enter the admin password to unlock simulator controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password === 'ottoyard-admin') setUnlocked(true);
            }}
          />
          <Button
            className="w-full"
            onClick={() => {
              if (password === 'ottoyard-admin') {
                setUnlocked(true);
              } else {
                toast.error('Incorrect password');
              }
            }}
          >
            Unlock
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <AdminUserManagement />
      <SimulatorControlPanel />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Bot className="h-5 w-5 mr-2 text-primary" />
            AV Command Simulator
          </CardTitle>
          <CardDescription>Internal AV fleet orchestration simulator</CardDescription>
        </CardHeader>
        <CardContent>
          <AVSimulation />
        </CardContent>
      </Card>
    </div>
  );
}

const SettingsHub: React.FC<SettingsHubProps> = ({
  children,
  cartItems,
  onRemoveFromCart,
  onCheckout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('cart');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orderReviewOpen, setOrderReviewOpen] = useState(false);
  const [hasBillingAccount, setHasBillingAccount] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);

  // Cart calculations
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const cartCount = cartItems.length;

  // Fetch user data when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchUserData();
    }
  }, [isOpen]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile({
          full_name: profileData.full_name,
          company_name: profileData.company_name,
          phone: profileData.phone,
          billing_email: (profileData as any).billing_email,
          notification_settings_jsonb: (profileData as any).notification_settings_jsonb || defaultProfile.notification_settings_jsonb,
          fleet_settings_jsonb: (profileData as any).fleet_settings_jsonb || defaultProfile.fleet_settings_jsonb,
          ai_preferences_jsonb: (profileData as any).ai_preferences_jsonb || defaultProfile.ai_preferences_jsonb,
        });
      }

      // Fetch API keys
      const { data: keysData } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      
      setApiKeys(keysData || []);

      // Fetch activity logs
      const { data: logsData } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      setActivityLogs(logsData || []);

      // Check billing account status
      const { data: billingData } = await supabase
        .from('billing_customers')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setHasBillingAccount(!!billingData?.stripe_customer_id);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          company_name: profile.company_name,
          phone: profile.phone,
          billing_email: profile.billing_email,
          notification_settings_jsonb: profile.notification_settings_jsonb,
          fleet_settings_jsonb: profile.fleet_settings_jsonb,
          ai_preferences_jsonb: profile.ai_preferences_jsonb,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleStripeCheckout = async () => {
    if (cartItems.length === 0) return;
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        body: { items: cartItems },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setBillingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-portal', {});
      if (error) {
        const errorMessage = error.message || '';
        if (errorMessage.includes('No billing account') || errorMessage.includes('make a purchase')) {
          toast.info('Complete a purchase to access billing management');
          return;
        }
        throw error;
      }
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      if (error?.context?.body) {
        try {
          const body = JSON.parse(error.context.body);
          if (body.error?.includes('No billing account') || body.error?.includes('make a purchase')) {
            toast.info('Complete a purchase to access billing management');
            return;
          }
        } catch {}
      }
      toast.error('Failed to open billing portal');
    } finally {
      setBillingLoading(false);
    }
  };

  const generateApiKey = async () => {
    setGeneratingKey(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-key-generate', {
        body: { name: `API Key ${apiKeys.length + 1}` },
      });

      if (error) throw error;
      toast.success('API key generated');
      fetchUserData();
    } catch (error) {
      console.error('Error generating API key:', error);
      toast.error('Failed to generate API key');
    } finally {
      setGeneratingKey(false);
    }
  };

  const revokeApiKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId);

      if (error) throw error;
      toast.success('API key revoked');
      fetchUserData();
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error('Failed to revoke API key');
    }
  };

  const updateNotificationSetting = (key: keyof typeof profile.notification_settings_jsonb, value: any) => {
    setProfile(prev => ({
      ...prev,
      notification_settings_jsonb: {
        ...prev.notification_settings_jsonb,
        [key]: value,
      },
    }));
  };

  const updateFleetSetting = (key: keyof typeof profile.fleet_settings_jsonb, value: number) => {
    setProfile(prev => ({
      ...prev,
      fleet_settings_jsonb: {
        ...prev.fleet_settings_jsonb,
        [key]: value,
      },
    }));
  };

  // The profile also holds ai_preferences_jsonb.model. No screen sets it now: it chose between three vendors' models
  // by name, and nothing in the app or its functions read the choice. The saved value is kept as it is.
  const updateAIPreference = (key: string, value: boolean) => {
    setProfile(prev => ({
      ...prev,
      ai_preferences_jsonb: {
        ...prev.ai_preferences_jsonb,
        features: {
          ...prev.ai_preferences_jsonb.features,
          [key]: value,
        },
      },
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        {/* Header with user info */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-card to-muted/30">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-primary/20">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {profile.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{profile.full_name || 'Fleet Manager'}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Building className="h-3 w-3" />
                {profile.company_name || 'OTTOYARD Fleet Services'}
              </p>
            </div>
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
              <Activity className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6 pt-2">
            <TabsList className="grid w-full grid-cols-4 md:grid-cols-8 grid-rows-2 md:grid-rows-1 h-auto md:h-10 gap-0.5 md:gap-0">
              <TabsTrigger value="cart" className="text-[10px] md:text-xs relative">
                <ShoppingCart className="hidden md:inline h-3 w-3 mr-1" />
                Cart
                {cartCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                    {cartCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="profile" className="text-[10px] md:text-xs">
                <User className="hidden md:inline h-3 w-3 mr-1" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="billing" className="text-[10px] md:text-xs">
                <CreditCard className="hidden md:inline h-3 w-3 mr-1" />
                Billing
              </TabsTrigger>
              <TabsTrigger value="fleet" className="text-[10px] md:text-xs">
                <Zap className="hidden md:inline h-3 w-3 mr-1" />
                Fleet
              </TabsTrigger>
              <TabsTrigger value="alerts" className="text-[10px] md:text-xs">
                <Bell className="hidden md:inline h-3 w-3 mr-1" />
                Alerts
              </TabsTrigger>
              <TabsTrigger value="integrations" className="text-[10px] md:text-xs">
                <Database className="hidden md:inline h-3 w-3 mr-1" />
                Services
              </TabsTrigger>
              <TabsTrigger value="security" className="text-[10px] md:text-xs">
                <Shield className="hidden md:inline h-3 w-3 mr-1" />
                Security
              </TabsTrigger>
              <TabsTrigger value="admin" className="text-[10px] md:text-xs">
                <Bot className="hidden md:inline h-3 w-3 mr-1" />
                Admin
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[calc(90vh-220px)] px-6 py-4">
            {/* Cart Tab */}
            <TabsContent value="cart" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <ShoppingCart className="h-5 w-5 mr-2 text-primary" />
                    Service Cart
                  </CardTitle>
                  <CardDescription>
                    Review your scheduled services and proceed to checkout
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cartCount === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Your cart is empty</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add services from the Maintenance tab
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {cartItems.map((item) => (
                          <div key={item.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex-1">
                              <h4 className="font-medium">{item.serviceName}</h4>
                              <p className="text-sm text-muted-foreground">{item.vehicleName}</p>
                              {item.date && item.time && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.date} at {item.time}
                                </p>
                              )}
                              {item.depot && (
                                <p className="text-xs text-muted-foreground">
                                  Location: {item.depot}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">${item.price}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemoveFromCart(item.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal</span>
                          <span>${cartTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Tax (estimated)</span>
                          <span>${Math.round(cartTotal * 0.0825).toLocaleString()}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total</span>
                          <span>${Math.round(cartTotal * 1.0825).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)}>
                          Continue Shopping
                        </Button>
                        <Button
                          onClick={() => setOrderReviewOpen(true)}
                          className="bg-gradient-to-r from-primary to-primary/80"
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Review Order
                        </Button>
                      </div>

                      <OrderReviewDialog
                        open={orderReviewOpen}
                        onOpenChange={setOrderReviewOpen}
                        items={cartItems}
                        onConfirmCheckout={handleStripeCheckout}
                        isLoading={checkoutLoading}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2 text-primary" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={profile.full_name || ''}
                        onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={user?.email || ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={profile.company_name || ''}
                        onChange={(e) => setProfile(prev => ({ ...prev, company_name: e.target.value }))}
                        placeholder="ACME Fleet Services"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={profile.phone || ''}
                        onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center">
                      <Bot className="h-4 w-4 mr-2" />
                      AI Preferences
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <Label className="text-sm">Predictive Maintenance</Label>
                        <Switch
                          checked={profile.ai_preferences_jsonb.features.predictive_maintenance}
                          onCheckedChange={(v) => updateAIPreference('predictive_maintenance', v)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <Label className="text-sm">Smart Routing</Label>
                        <Switch
                          checked={profile.ai_preferences_jsonb.features.smart_routing}
                          onCheckedChange={(v) => updateAIPreference('smart_routing', v)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <Label className="text-sm">Auto Recommendations</Label>
                        <Switch
                          checked={profile.ai_preferences_jsonb.features.auto_recommendations}
                          onCheckedChange={(v) => updateAIPreference('auto_recommendations', v)}
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={saveProfile} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Save Profile
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing" className="mt-0 space-y-6">
              {/* Account Overview */}
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Account Overview
                </h3>
                <AccountOverview />
              </div>

              <Separator />

              {/* Billing Portal Access */}
              {hasBillingAccount ? (
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Billing Management
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Manage payment methods, view Stripe invoices, and update billing details.
                  </p>
                  <Button onClick={handleManageBilling} variant="outline" disabled={billingLoading}>
                    {billingLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Open Billing Portal
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">No billing account yet</p>
                    <p className="text-sm text-muted-foreground">
                      Complete a purchase to set up billing management.
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Monthly Statements */}
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Monthly Statements
                </h3>
                <p className="text-sm text-muted-foreground">
                  Download detailed monthly statements with all your orders.
                </p>
                <MonthlyStatements />
              </div>

              <Separator />

              {/* Order History */}
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Order History
                </h3>
                <InvoiceHistory />
              </div>
            </TabsContent>

            {/* Fleet Tab */}
            <TabsContent value="fleet" className="mt-0 space-y-6">
              {/* My Fleet Vehicles */}
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  My Fleet Vehicles
                </h3>
                <p className="text-sm text-muted-foreground">
                  Manage your registered fleet vehicles for tracking and services.
                </p>
                <FleetVehicles />
              </div>

              <Separator />

              {/* Fleet Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="h-5 w-5 mr-2 text-primary" />
                    Fleet Settings
                  </CardTitle>
                  <CardDescription>
                    Configure default thresholds and settings for your fleet operations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Low Battery Threshold (%)</Label>
                      <Input
                        type="number"
                        value={profile.fleet_settings_jsonb.battery_threshold}
                        onChange={(e) => updateFleetSetting('battery_threshold', parseInt(e.target.value) || 20)}
                        min={5}
                        max={50}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Maintenance Interval (days)</Label>
                      <Input
                        type="number"
                        value={profile.fleet_settings_jsonb.maintenance_interval_days}
                        onChange={(e) => updateFleetSetting('maintenance_interval_days', parseInt(e.target.value) || 30)}
                        min={7}
                        max={180}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Depot Capacity (kWh)</Label>
                      <Input
                        type="number"
                        value={profile.fleet_settings_jsonb.default_depot_capacity_kwh}
                        onChange={(e) => updateFleetSetting('default_depot_capacity_kwh', parseInt(e.target.value) || 5000)}
                        min={1000}
                        max={50000}
                      />
                    </div>
                  </div>

                  <Button onClick={saveProfile} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Save Fleet Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Alerts Tab */}
            <TabsContent value="alerts" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="h-5 w-5 mr-2 text-primary" />
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <h4 className="font-medium">Channels</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <Label>Email</Label>
                        <Switch
                          checked={profile.notification_settings_jsonb.email}
                          onCheckedChange={(v) => updateNotificationSetting('email', v)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <Label>Push</Label>
                        <Switch
                          checked={profile.notification_settings_jsonb.push}
                          onCheckedChange={(v) => updateNotificationSetting('push', v)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <Label>SMS</Label>
                        <Switch
                          checked={profile.notification_settings_jsonb.sms}
                          onCheckedChange={(v) => updateNotificationSetting('sms', v)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Alert Types</h4>
                    {[
                      { key: 'low_battery', label: 'Low Battery Alerts', desc: 'When vehicles drop below threshold' },
                      { key: 'maintenance', label: 'Maintenance Reminders', desc: 'Upcoming scheduled maintenance' },
                      { key: 'route_alerts', label: 'Route Alerts', desc: 'Route deviations and delays' },
                      { key: 'energy_thresholds', label: 'Energy Thresholds', desc: 'Depot energy level warnings' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <Label>{item.label}</Label>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <Switch
                          checked={profile.notification_settings_jsonb[item.key as keyof typeof profile.notification_settings_jsonb] as boolean}
                          onCheckedChange={(v) => updateNotificationSetting(item.key as any, v)}
                        />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Digest Frequency</Label>
                    <Select
                      value={profile.notification_settings_jsonb.digest_frequency}
                      onValueChange={(v) => updateNotificationSetting('digest_frequency', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">Real-time</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={saveProfile} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Save Alert Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent value="integrations" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="h-5 w-5 mr-2 text-primary" />
                    Connected Services
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: 'Maps', desc: 'Live map and route optimization', icon: Map, status: 'connected' },
                    { name: 'Data and sign-in', desc: 'Database and authentication', icon: Database, status: 'connected' },
                    { name: 'Payments', desc: 'Card payments and billing', icon: CreditCard, status: 'connected' },
                    { name: 'Weather', desc: 'Real-time weather data', icon: Activity, status: 'connected' },
                  ].map((service) => (
                    <div key={service.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <service.icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-xs text-muted-foreground">{service.desc}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        Connected
                      </Badge>
                    </div>
                  ))}

                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Key className="h-5 w-5 mr-2 text-primary" />
                    API Keys
                  </CardTitle>
                  <CardDescription>
                    Manage API keys for external integrations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={generateApiKey} disabled={generatingKey} variant="outline" className="w-full">
                    {generatingKey ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
                    Generate New API Key
                  </Button>

                  {apiKeys.length > 0 ? (
                    <div className="space-y-2">
                      {apiKeys.map((key) => (
                        <div key={key.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{key.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {key.key_prefix}...
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => revokeApiKey(key.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No API keys generated yet
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-primary" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activityLogs.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm">{log.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent activity
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-primary" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                    </div>
                    <Badge variant="outline" className="text-warning border-warning/20">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Not Enabled
                    </Badge>
                  </div>
                  <Button variant="outline" className="w-full">
                    Enable 2FA
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Admin Tab */}
            <TabsContent value="admin" className="mt-0 space-y-4">
              <AdminGatedContent />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsHub;
