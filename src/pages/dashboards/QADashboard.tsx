import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ParticleBackground } from "@/components/ui/particle-background";
import InspectionModal from "@/components/ui/InspectionModal";
import CertificateModal from "@/components/ui/CertificateModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Shield, 
  Calendar as CalendarIcon, 
  FileCheck, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  MapPin,
  User,
  Building,
  Download,
  Plus,
  Package
} from "lucide-react";

const QADashboard = () => {
  // All hooks at top before any early returns
  const { user, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("available");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [inspections, setInspections] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    scheduled: 0,
    issued: 0,
    availableForInspection: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchInspections = async () => {
    try {
      const { data: inspections, error } = await supabase
        .from('inspection_actions')
        .select('*')
        .eq('inspector_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get batch details separately
      if (inspections && inspections.length > 0) {
        const batchIds = inspections.map(i => i.batch_id).filter(Boolean);
        const { data: batches } = await supabase
          .from('batches')
          .select('*')
          .in('id', batchIds);

        // Get user profiles for batch owners
        const userIds = [...new Set(batches?.map(b => b.user_id) || [])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, organization_name')
          .in('user_id', userIds);

        // Create maps for easy lookup
        const batchMap = new Map();
        batches?.forEach(batch => {
          batchMap.set(batch.id, batch);
        });

        const profileMap = new Map();
        profiles?.forEach(profile => {
          profileMap.set(profile.user_id, profile);
        });

        // Combine inspection data with batch and profile data
        const inspectionsWithDetails = inspections.map(inspection => ({
          ...inspection,
          batches: inspection.batch_id ? {
            ...batchMap.get(inspection.batch_id),
            profiles: batchMap.get(inspection.batch_id) 
              ? profileMap.get(batchMap.get(inspection.batch_id).user_id)
              : null
          } : null
        }));

        setInspections(inspectionsWithDetails);
      } else {
        setInspections(inspections || []);
      }
      
      // Update stats
      const pending = inspections?.filter(i => i.status === 'pending').length || 0;
      const completed = inspections?.filter(i => i.status === 'completed').length || 0;
      const scheduled = inspections?.filter(i => i.status === 'scheduled').length || 0;
      
      setStats(prev => ({ ...prev, pending, completed, scheduled }));
    } catch (error: any) {
      console.error('Error fetching inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCertificates = async () => {
    try {
      const { data: certificates, error } = await supabase
        .from('digital_certificates')
        .select('*')
        .eq('issued_by', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get batch and profile details separately
      if (certificates && certificates.length > 0) {
        // Get batch details
        const batchIds = certificates.map(c => c.batch_id).filter(Boolean);
        const { data: batches } = await supabase
          .from('batches')
          .select('id, batch_number, product_name')
          .in('id', batchIds);

        // Get profile details for certificate recipients
        const userIds = certificates.map(c => c.issued_to).filter(Boolean);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, organization_name')
          .in('user_id', userIds);

        // Create maps for easy lookup
        const batchMap = new Map();
        batches?.forEach(batch => {
          batchMap.set(batch.id, batch);
        });

        const profileMap = new Map();
        profiles?.forEach(profile => {
          profileMap.set(profile.user_id, profile);
        });

        // Combine certificate data
        const certificatesWithDetails = certificates.map(cert => ({
          ...cert,
          batches: cert.batch_id ? batchMap.get(cert.batch_id) : null,
          profiles: cert.issued_to ? profileMap.get(cert.issued_to) : null
        }));

        setCertificates(certificatesWithDetails);
      } else {
        setCertificates(certificates || []);
      }
      
      setStats(prev => ({ ...prev, issued: certificates?.length || 0 }));
    } catch (error: any) {
      console.error('Error fetching certificates:', error);
    }
  };

  const fetchAvailableBatches = async () => {
    try {
      console.log('🔍 QA Dashboard: Fetching available batches...');
      console.log('🔐 Current user:', user?.id);
      console.log('👤 Current user profile:', profile);
      
      // First, test if we can fetch all batches (for debugging)
      const { data: allBatches, error: allBatchesError } = await supabase
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('🔓 ALL batches accessible to QA user:', allBatches?.length, allBatchesError);
      if (allBatches && allBatches.length > 0) {
        console.log('📊 Sample of accessible batches:', allBatches.slice(0, 3));
      }
      
      // Get submitted batches without the profiles join first
      const { data: batches, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .in('status', ['submitted', 'pending_inspection'])
        .order('created_at', { ascending: false });

      if (batchError) {
        console.error('❌ Error fetching submitted batches:', batchError);
        console.error('❌ Batch error details:', batchError.message, batchError.code, batchError.details, batchError.hint);
        throw batchError;
      }
      
      console.log('📦 Submitted batches found:', batches?.length, batches);
      
      // Also try with different status filters to see what we get
      const { data: allStatusBatches, error: allStatusError } = await supabase
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false });
        
      console.log('🔄 All status batches:', allStatusBatches?.length);
      if (allStatusBatches && allStatusBatches.length > 0) {
        const statusCounts = allStatusBatches.reduce((acc, batch) => {
          acc[batch.status] = (acc[batch.status] || 0) + 1;
          return acc;
        }, {});
        console.log('📈 Status distribution:', statusCounts);
      }
      
      if (!batches || batches.length === 0) {
        console.log('ℹ️ No submitted batches found');
        setAvailableBatches([]);
        setStats(prev => ({ ...prev, availableForInspection: 0 }));
        return;
      }

      // Get user profiles separately
      const userIds = [...new Set(batches.map(b => b.user_id))];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, organization_name')
        .in('user_id', userIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      }

      // Create a map of user profiles
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.user_id, profile);
      });

      // Add profile data to batches
      const batchesWithProfiles = batches.map(batch => ({
        ...batch,
        profiles: profileMap.get(batch.user_id)
      }));

      // Then check which ones already have inspection actions
      const batchIds = batches.map(b => b.id);
      const { data: existingInspections, error: inspectionError } = await supabase
        .from('inspection_actions')
        .select('batch_id')
        .in('batch_id', batchIds);

      if (inspectionError) {
        console.error('Error fetching existing inspections:', inspectionError);
        // Continue anyway, show all batches
      }

      const inspectedBatchIds = new Set(existingInspections?.map(i => i.batch_id) || []);
      const batchesNeedingInspection = batchesWithProfiles.filter(batch => !inspectedBatchIds.has(batch.id));
      
      console.log('Batches with existing inspections:', inspectedBatchIds);
      console.log('Batches needing inspection:', batchesNeedingInspection.length, batchesNeedingInspection);
      
      setAvailableBatches(batchesNeedingInspection);
      setStats(prev => ({ ...prev, availableForInspection: batchesNeedingInspection.length }));
    } catch (error: any) {
      console.error('Error fetching available batches:', error);
      toast({
        title: "Error loading batches",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTakeInspection = async (batch: any) => {
    try {
      // Create inspection action for this batch
      const { data, error } = await supabase
        .from('inspection_actions')
        .insert({
          batch_id: batch.id,
          inspector_id: user?.id,
          status: 'pending',
          priority: 'medium',
          location: batch.origin_location,
          contact_person: `${batch.profiles?.first_name} ${batch.profiles?.last_name}`,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Update batch status
      await supabase
        .from('batches')
        .update({ status: 'inspection' })
        .eq('id', batch.id);

      toast({
        title: "Inspection assigned",
        description: `You have taken responsibility for inspecting batch ${batch.batch_number}`,
      });

      // Refresh data
      fetchInspections();
      fetchAvailableBatches();
    } catch (error: any) {
      console.error('Error taking inspection:', error);
      toast({
        title: "Error",
        description: "Failed to assign inspection. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchInspections();
      fetchCertificates();
      fetchAvailableBatches();

      // Set up real-time subscriptions
      const inspectionsChannel = supabase
        .channel('qa-inspections')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'inspection_actions',
          filter: `inspector_id=eq.${user.id}`
        }, fetchInspections)
        .subscribe();

      const certificatesChannel = supabase
        .channel('qa-certificates')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'digital_certificates',
          filter: `issued_by=eq.${user.id}`
        }, fetchCertificates)
        .subscribe();

      // Listen for new batches being submitted
      const batchesChannel = supabase
        .channel('qa-batches')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'batches'
        }, (payload) => {
          console.log('Batch table changed:', payload.eventType, payload.new || payload.old);
          console.log('Batch payload:', payload);
          fetchAvailableBatches();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(inspectionsChannel);
        supabase.removeChannel(certificatesChannel);
        supabase.removeChannel(batchesChannel);
      };
    }
  }, [user]);

  // Auth/role guard using Supabase profile/metadata
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = (profile?.role || user.user_metadata?.role || "").toLowerCase();
  if (role && role !== "qa_agency" && role !== "qa") {
    switch (role) {
      case "exporter":
        return <Navigate to="/dashboard/exporter" replace />;
      case "importer":
        return <Navigate to="/dashboard/importer" replace />;
      case "admin":
        return <Navigate to="/dashboard/admin" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  // Dynamic stats based on real data
  const dynamicStats = [
    { title: "Available for Inspection", value: stats.availableForInspection.toString(), color: "text-info", bg: "bg-info/10" },
    { title: "Pending Inspections", value: stats.pending.toString(), color: "text-warning", bg: "bg-warning/10" },
    { title: "Completed Today", value: stats.completed.toString(), color: "text-success", bg: "bg-success/10" },
    { title: "Certificates Issued", value: stats.issued.toString(), color: "text-primary", bg: "bg-primary/10" }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive text-destructive-foreground";
      case "medium": return "bg-warning text-warning-foreground";
      case "low": return "bg-success text-success-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle relative">
      <ParticleBackground particleCount={30} speed={0.0001} />
      <div className="container mx-auto px-4 py-8 space-y-8 relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">QA Agency Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage inspections and issue quality certificates</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="lg" onClick={() => setIsInspectionModalOpen(true)}>
            <CalendarIcon className="h-5 w-5 mr-2" />
            Schedule Inspection
          </Button>
          <Button variant="agri" size="lg" onClick={() => setIsCertificateModalOpen(true)}>
            <FileCheck className="h-5 w-5 mr-2" />
            Issue Certificate
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dynamicStats.map((stat, index) => (
          <Card key={index} className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <Shield className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Inspection Management */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="available">Available</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <Package className="h-5 w-5 text-info" />
                        <span>Available for Inspection</span>
                      </CardTitle>
                      <CardDescription>New batches submitted by exporters requiring inspection</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchAvailableBatches}>
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        <p className="text-muted-foreground mt-2">Loading available batches...</p>
                      </div>
                    ) : availableBatches.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No batches available for inspection.</p>
                      </div>
                    ) : (
                      availableBatches.map((batch) => (
                        <div key={batch.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <Badge className="bg-info/10 text-info border-info/20">
                                NEW
                              </Badge>
                              <span className="font-medium text-foreground">{batch.batch_number}</span>
                            </div>
                            <div className="flex space-x-2">
                              <Button variant="agri" size="sm" onClick={() => handleTakeInspection(batch)}>
                                <FileCheck className="h-4 w-4 mr-1" />
                                Take Inspection
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{batch.profiles?.organization_name}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{batch.profiles?.first_name} {batch.profiles?.last_name}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="font-medium text-foreground">{batch.product_name}</div>
                              <div className="flex items-center space-x-2 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>{batch.origin_location}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Submitted: {new Date(batch.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-warning" />
                    <span>Pending Inspections</span>
                  </CardTitle>
                  <CardDescription>Inspections awaiting your review and scheduling</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        <p className="text-muted-foreground mt-2">Loading inspections...</p>
                      </div>
                    ) : inspections.filter(i => i.status === 'pending').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No pending inspections.</p>
                      </div>
                    ) : (
                      inspections.filter(i => i.status === 'pending').map((inspection) => (
                        <div key={inspection.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <Badge className={getPriorityColor(inspection.priority)}>
                                {inspection.priority?.toUpperCase() || 'MEDIUM'}
                              </Badge>
                              <span className="font-medium text-foreground">{inspection.batches?.batch_number}</span>
                            </div>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm" onClick={() => setIsInspectionModalOpen(true)}>
                                <CalendarIcon className="h-4 w-4 mr-1" />
                                Schedule
                              </Button>
                              <Button variant="agri" size="sm" onClick={() => setIsInspectionModalOpen(true)}>
                                <FileCheck className="h-4 w-4 mr-1" />
                                Inspect
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{inspection.batches?.profiles?.organization_name}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{inspection.contact_person || 'N/A'}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="font-medium text-foreground">{inspection.batches?.product_name}</div>
                              <div className="flex items-center space-x-2 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>{inspection.location || inspection.batches?.origin_location}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scheduled">
              <Card>
                <CardHeader>
                  <CardTitle>Scheduled Inspections</CardTitle>
                  <CardDescription>Your upcoming inspection appointments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {inspections.filter(i => i.status === 'scheduled').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No scheduled inspections for today.</p>
                      </div>
                    ) : (
                      inspections.filter(i => i.status === 'scheduled').map((inspection) => (
                        <div key={inspection.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">{inspection.batches?.batch_number}</div>
                            <Badge className="bg-secondary text-secondary-foreground">Scheduled</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{inspection.batches?.product_name}</p>
                          <div className="flex items-center justify-between text-sm">
                            <span>📍 {inspection.location}</span>
                            <span>📅 {inspection.scheduled_date ? new Date(inspection.scheduled_date).toLocaleString() : 'TBD'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="completed">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Completed Inspections</CardTitle>
                      <CardDescription>Recently completed inspection reports</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsCertificateModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Issue Certificate
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {inspections.filter(i => i.status === 'completed').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Completed inspections will appear here.</p>
                      </div>
                    ) : (
                      inspections.filter(i => i.status === 'completed').map((inspection) => (
                        <div key={inspection.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">{inspection.batches?.batch_number}</div>
                            <div className="flex items-center space-x-2">
                              <Badge className="bg-success text-success-foreground">Completed</Badge>
                              {!inspection.certificate_issued && (
                                <Button variant="outline" size="sm" onClick={() => setIsCertificateModalOpen(true)}>
                                  <Shield className="h-4 w-4 mr-1" />
                                  Issue Cert
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{inspection.batches?.product_name}</p>
                          <div className="flex items-center justify-between text-sm">
                            <span>Score: {inspection.quality_score || 'N/A'}</span>
                            <span>Completed: {inspection.completed_date ? new Date(inspection.completed_date).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Calendar & Quick Actions */}
        <div className="space-y-6">
          {/* Calendar */}
          <Card>
            <CardHeader>
              <CardTitle>Inspection Calendar</CardTitle>
              <CardDescription>View and manage your schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={() => setIsInspectionModalOpen(true)}>
                <FileCheck className="h-4 w-4 mr-2" />
                Create Inspection Report
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setIsCertificateModalOpen(true)}>
                <Shield className="h-4 w-4 mr-2" />
                Issue Digital Certificate
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="h-4 w-4 mr-2" />
                View Schedule
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Download className="h-4 w-4 mr-2" />
                Download Reports
              </Button>
            </CardContent>
          </Card>

          {/* Today's Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Inspections Completed</span>
                <span className="font-medium">{stats.completed}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Certificates Issued</span>
                <span className="font-medium">{stats.issued}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Pending Reviews</span>
                <span className="font-medium">{stats.pending}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      {/* Inspection Modal */}
      <InspectionModal
        open={isInspectionModalOpen}
        onOpenChange={setIsInspectionModalOpen}
        onInspectionCompleted={fetchInspections}
      />

      {/* Certificate Modal */}
      <CertificateModal
        open={isCertificateModalOpen}
        onOpenChange={setIsCertificateModalOpen}
        onCertificateIssued={fetchCertificates}
      />
    </div>
  );
};

export default QADashboard;


// import { useState, useEffect } from "react";
// import { Navigate } from "react-router-dom"; // *** ADDED FOR GUARD ***
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Badge } from "@/components/ui/badge";
// import { Calendar } from "@/components/ui/calendar";
// import { ParticleBackground } from "@/components/ui/particle-background";
// import InspectionModal from "@/components/ui/InspectionModal";
// import CertificateModal from "@/components/ui/CertificateModal";
// import { supabase } from "@/integrations/supabase/client";
// import { useToast } from "@/hooks/use-toast";
// import { useAuth } from "@/hooks/useAuth";
// import {
//   Shield,
//   Calendar as CalendarIcon,
//   FileCheck,
//   Clock,
//   AlertTriangle,
//   CheckCircle,
//   MapPin,
//   User,
//   Building,
//   Download,
//   Plus,
// } from "lucide-react";

// // --- START of ROLE GUARD ---
// const QADashboard = () => {
//   const { user } = useAuth();

//   // Redirect unauthenticated users to login
//   if (!user) {
//     return <Navigate to="/login" />;
//   }
//   // Redirect users with wrong role
//   if (user.role !== "qa_agency") {
//     switch (user.role) {
//       case "exporter":
//         return <Navigate to="/dashboard/exporter" />;
//       case "importer":
//         return <Navigate to="/dashboard/importer" />;
//       case "admin":
//         return <Navigate to="/dashboard/admin" />;
//       default:
//         return <Navigate to="/login" />;
//     }
//   }
//   // --- END of ROLE GUARD ---

//   const [activeTab, setActiveTab] = useState("pending");
//   const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
//   const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
//   const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
//   const [inspections, setInspections] = useState<any[]>([]);
//   const [certificates, setCertificates] = useState<any[]>([]);
//   const [stats, setStats] = useState({
//     pending: 0,
//     completed: 0,
//     scheduled: 0,
//     issued: 0,
//   });
//   const [loading, setLoading] = useState(true);
//   const { toast } = useToast();

//   const fetchInspections = async () => {
//     try {
//       const { data, error } = await supabase
//         .from("inspection_actions")
//         .select(`
//           *,
//           batches(
//             id, batch_number, product_name, origin_location,
//             profiles!batches_user_id_fkey(first_name, last_name, organization_name)
//           )
//         `)
//         .eq("inspector_id", user?.id)
//         .order("created_at", { ascending: false });
//       if (error) throw error;
//       setInspections(data || []);
//       const pending = data?.filter((i) => i.status === "pending").length || 0;
//       const completed = data?.filter((i) => i.status === "completed").length || 0;
//       const scheduled = data?.filter((i) => i.status === "scheduled").length || 0;
//       setStats((prev) => ({ ...prev, pending, completed, scheduled }));
//     } catch (error: any) {
//       console.error("Error fetching inspections:", error);
//     } finally {
//       setLoading(false);
//     }
//   };
//   const fetchCertificates = async () => {
//     try {
//       const { data, error } = await supabase
//         .from("digital_certificates")
//         .select(`
//           *,
//           batches(batch_number, product_name),
//           profiles!digital_certificates_issued_to_fkey(first_name, last_name, organization_name)
//         `)
//         .eq("issued_by", user?.id)
//         .order("created_at", { ascending: false });
//       if (error) throw error;
//       setCertificates(data || []);
//       setStats((prev) => ({ ...prev, issued: data?.length || 0 }));
//     } catch (error: any) {
//       console.error("Error fetching certificates:", error);
//     }
//   };
//   useEffect(() => {
//     if (user) {
//       fetchInspections();
//       fetchCertificates();
//       const inspectionsChannel = supabase
//         .channel("qa-inspections")
//         .on(
//           "postgres_changes",
//           {
//             event: "*",
//             schema: "public",
//             table: "inspection_actions",
//             filter: `inspector_id=eq.${user.id}`,
//           },
//           fetchInspections
//         )
//         .subscribe();
//       const certificatesChannel = supabase
//         .channel("qa-certificates")
//         .on(
//           "postgres_changes",
//           {
//             event: "*",
//             schema: "public",
//             table: "digital_certificates",
//             filter: `issued_by=eq.${user.id}`,
//           },
//           fetchCertificates
//         )
//         .subscribe();
//       return () => {
//         supabase.removeChannel(inspectionsChannel);
//         supabase.removeChannel(certificatesChannel);
//       };
//     }
//   }, [user]);
//   const dynamicStats = [
//     { title: "Pending Inspections", value: stats.pending.toString(), color: "text-warning", bg: "bg-warning/10" },
//     { title: "Completed Today", value: stats.completed.toString(), color: "text-success", bg: "bg-success/10" },
//     { title: "Scheduled This Week", value: stats.scheduled.toString(), color: "text-secondary", bg: "bg-secondary/10" },
//     { title: "Certificates Issued", value: stats.issued.toString(), color: "text-primary", bg: "bg-primary/10" },
//   ];
//   const getPriorityColor = (priority: string) => {
//     switch (priority) {
//       case "high":
//         return "bg-destructive text-destructive-foreground";
//       case "medium":
//         return "bg-warning text-warning-foreground";
//       case "low":
//         return "bg-success text-success-foreground";
//       default:
//         return "bg-muted text-muted-foreground";
//     }
//   };
//   return (
//     <div className="min-h-screen bg-gradient-subtle relative">
//       <ParticleBackground particleCount={30} speed={0.0001} />
//       <div className="container mx-auto px-4 py-8 space-y-8 relative z-10">
//         {/* Header */}
//         <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
//           <div>
//             <h1 className="text-3xl font-bold text-foreground">QA Agency Dashboard</h1>
//             <p className="text-muted-foreground mt-1">Manage inspections and issue quality certificates</p>
//           </div>
//           <div className="flex space-x-3">
//             <Button variant="outline" size="lg" onClick={() => setIsInspectionModalOpen(true)}>
//               <CalendarIcon className="h-5 w-5 mr-2" />
//               Schedule Inspection
//             </Button>
//             <Button variant="agri" size="lg" onClick={() => setIsCertificateModalOpen(true)}>
//               <FileCheck className="h-5 w-5 mr-2" />
//               Issue Certificate
//             </Button>
//           </div>
//         </div>
//         {/* Stats Cards */}
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
//           {dynamicStats.map((stat, index) => (
//             <Card key={index} className="hover-lift">
//               <CardContent className="p-6">
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
//                     <p className="text-2xl font-bold text-foreground">{stat.value}</p>
//                   </div>
//                   <div className={`p-3 rounded-lg ${stat.bg}`}>
//                     <Shield className={`h-6 w-6 ${stat.color}`} />
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           ))}
//         </div>
//         {/* Main Content */}
//         <div className="grid lg:grid-cols-3 gap-8">
//           {/* Inspection Management */}
//           <div className="lg:col-span-2">
//             <Tabs value={activeTab} onValueChange={setActiveTab}>
//               <TabsList className="grid w-full grid-cols-3">
//                 <TabsTrigger value="pending">Pending</TabsTrigger>
//                 <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
//                 <TabsTrigger value="completed">Completed</TabsTrigger>
//               </TabsList>
//               <TabsContent value="pending" className="space-y-4">
//                 <Card>
//                   <CardHeader>
//                     <CardTitle className="flex items-center space-x-2">
//                       <Clock className="h-5 w-5 text-warning" />
//                       <span>Pending Inspections</span>
//                     </CardTitle>
//                     <CardDescription>Inspections awaiting your review and scheduling</CardDescription>
//                   </CardHeader>
//                   <CardContent>
//                     <div className="space-y-4">
//                       {loading ? (
//                         <div className="text-center py-8">
//                           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
//                           <p className="text-muted-foreground mt-2">Loading inspections...</p>
//                         </div>
//                       ) : inspections.filter((i) => i.status === "pending").length === 0 ? (
//                         <div className="text-center py-8 text-muted-foreground">
//                           <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
//                           <p>No pending inspections.</p>
//                         </div>
//                       ) : (
//                         inspections
//                           .filter((i) => i.status === "pending")
//                           .map((inspection) => (
//                             <div key={inspection.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
//                               <div className="flex items-center justify-between mb-3">
//                                 <div className="flex items-center space-x-3">
//                                   <Badge className={getPriorityColor(inspection.priority)}>
//                                     {inspection.priority?.toUpperCase() || "MEDIUM"}
//                                   </Badge>
//                                   <span className="font-medium text-foreground">{inspection.batches?.batch_number}</span>
//                                 </div>
//                                 <div className="flex space-x-2">
//                                   <Button variant="outline" size="sm" onClick={() => setIsInspectionModalOpen(true)}>
//                                     <CalendarIcon className="h-4 w-4 mr-1" />
//                                     Schedule
//                                   </Button>
//                                   <Button variant="agri" size="sm" onClick={() => setIsInspectionModalOpen(true)}>
//                                     <FileCheck className="h-4 w-4 mr-1" />
//                                     Inspect
//                                   </Button>
//                                 </div>
//                               </div>
//                               <div className="grid md:grid-cols-2 gap-4 text-sm">
//                                 <div className="space-y-2">
//                                   <div className="flex items-center space-x-2">
//                                     <Building className="h-4 w-4 text-muted-foreground" />
//                                     <span className="font-medium">{inspection.batches?.profiles?.organization_name}</span>
//                                   </div>
//                                   <div className="flex items-center space-x-2">
//                                     <User className="h-4 w-4 text-muted-foreground" />
//                                     <span>{inspection.contact_person || "N/A"}</span>
//                                   </div>
//                                 </div>
//                                 <div className="space-y-2">
//                                   <div className="font-medium text-foreground">{inspection.batches?.product_name}</div>
//                                   <div className="flex items-center space-x-2 text-muted-foreground">
//                                     <MapPin className="h-4 w-4" />
//                                     <span>{inspection.location || inspection.batches?.origin_location}</span>
//                                   </div>
//                                 </div>
//                               </div>
//                             </div>
//                           ))
//                       )}
//                     </div>
//                   </CardContent>
//                 </Card>
//               </TabsContent>
//               <TabsContent value="scheduled">
//                 <Card>
//                   <CardHeader>
//                     <CardTitle>Scheduled Inspections</CardTitle>
//                     <CardDescription>Your upcoming inspection appointments</CardDescription>
//                   </CardHeader>
//                   <CardContent>
//                     <div className="space-y-4">
//                       {inspections.filter((i) => i.status === "scheduled").length === 0 ? (
//                         <div className="text-center py-8 text-muted-foreground">
//                           <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
//                           <p>No scheduled inspections for today.</p>
//                         </div>
//                       ) : (
//                         inspections
//                           .filter((i) => i.status === "scheduled")
//                           .map((inspection) => (
//                             <div key={inspection.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
//                               <div className="flex items-center justify-between mb-2">
//                                 <div className="font-medium">{inspection.batches?.batch_number}</div>
//                                 <Badge className="bg-secondary text-secondary-foreground">Scheduled</Badge>
//                               </div>
//                               <p className="text-sm text-muted-foreground mb-2">{inspection.batches?.product_name}</p>
//                               <div className="flex items-center justify-between text-sm">
//                                 <span>📍 {inspection.location}</span>
//                                 <span>
//                                   📅{" "}
//                                   {inspection.scheduled_date
//                                     ? new Date(inspection.scheduled_date).toLocaleString()
//                                     : "TBD"}
//                                 </span>
//                               </div>
//                             </div>
//                           ))
//                       )}
//                     </div>
//                   </CardContent>
//                 </Card>
//               </TabsContent>
//               <TabsContent value="completed">
//                 <Card>
//                   <CardHeader>
//                     <div className="flex justify-between items-center">
//                       <div>
//                         <CardTitle>Completed Inspections</CardTitle>
//                         <CardDescription>Recently completed inspection reports</CardDescription>
//                       </div>
//                       <Button variant="outline" size="sm" onClick={() => setIsCertificateModalOpen(true)}>
//                         <Plus className="h-4 w-4 mr-2" />
//                         Issue Certificate
//                       </Button>
//                     </div>
//                   </CardHeader>
//                   <CardContent>
//                     <div className="space-y-4">
//                       {inspections.filter((i) => i.status === "completed").length === 0 ? (
//                         <div className="text-center py-8 text-muted-foreground">
//                           <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
//                           <p>Completed inspections will appear here.</p>
//                         </div>
//                       ) : (
//                         inspections
//                           .filter((i) => i.status === "completed")
//                           .map((inspection) => (
//                             <div key={inspection.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
//                               <div className="flex items-center justify-between mb-2">
//                                 <div className="font-medium">{inspection.batches?.batch_number}</div>
//                                 <div className="flex items-center space-x-2">
//                                   <Badge className="bg-success text-success-foreground">Completed</Badge>
//                                   {!inspection.certificate_issued && (
//                                     <Button
//                                       variant="outline"
//                                       size="sm"
//                                       onClick={() => setIsCertificateModalOpen(true)}
//                                     >
//                                       <Shield className="h-4 w-4 mr-1" />
//                                       Issue Cert
//                                     </Button>
//                                   )}
//                                 </div>
//                               </div>
//                               <p className="text-sm text-muted-foreground mb-2">{inspection.batches?.product_name}</p>
//                               <div className="flex items-center justify-between text-sm">
//                                 <span>Score: {inspection.quality_score || "N/A"}</span>
//                                 <span>
//                                   Completed:{" "}
//                                   {inspection.completed_date
//                                     ? new Date(inspection.completed_date).toLocaleDateString()
//                                     : "N/A"}
//                                 </span>
//                               </div>
//                             </div>
//                           ))
//                       )}
//                     </div>
//                   </CardContent>
//                 </Card>
//               </TabsContent>
//             </Tabs>
//           </div>
//           {/* Calendar & Quick Actions */}
//           <div className="space-y-6">
//             {/* Calendar */}
//             <Card>
//               <CardHeader>
//                 <CardTitle>Inspection Calendar</CardTitle>
//                 <CardDescription>View and manage your schedule</CardDescription>
//               </CardHeader>
//               <CardContent>
//                 <Calendar
//                   mode="single"
//                   selected={selectedDate}
//                   onSelect={setSelectedDate}
//                   className="rounded-md border"
//                 />
//               </CardContent>
//             </Card>
//             {/* Quick Actions */}
//             <Card>
//               <CardHeader>
//                 <CardTitle>Quick Actions</CardTitle>
//               </CardHeader>
//               <CardContent className="space-y-3">
//                 <Button
//                   variant="outline"
//                   className="w-full justify-start"
//                   onClick={() => setIsInspectionModalOpen(true)}
//                 >
//                   <FileCheck className="h-4 w-4 mr-2" />
//                   Create Inspection Report
//                 </Button>
//                 <Button
//                   variant="outline"
//                   className="w-full justify-start"
//                   onClick={() => setIsCertificateModalOpen(true)}
//                 >
//                   <Shield className="h-4 w-4 mr-2" />
//                   Issue Digital Certificate
//                 </Button>
//                 <Button variant="outline" className="w-full justify-start">
//                   <CalendarIcon className="h-4 w-4 mr-2" />
//                   View Schedule
//                 </Button>
//                 <Button variant="outline" className="w-full justify-start">
//                   <Download className="h-4 w-4 mr-2" />
//                   Download Reports
//                 </Button>
//               </CardContent>
//             </Card>
//             {/* Today's Summary */}
//             <Card>
//               <CardHeader>
//                 <CardTitle>Today's Summary</CardTitle>
//               </CardHeader>
//               <CardContent className="space-y-3">
//                 <div className="flex justify-between items-center text-sm">
//                   <span className="text-muted-foreground">Inspections Completed</span>
//                   <span className="font-medium">{stats.completed}</span>
//                 </div>
//                 <div className="flex justify-between items-center text-sm">
//                   <span className="text-muted-foreground">Certificates Issued</span>
//                   <span className="font-medium">{stats.issued}</span>
//                 </div>
//                 <div className="flex justify-between items-center text-sm">
//                   <span className="text-muted-foreground">Pending Reviews</span>
//                   <span className="font-medium">{stats.pending}</span>
//                 </div>
//               </CardContent>
//             </Card>
//           </div>
//         </div>
//       </div>
//       {/* Inspection Modal */}
//       <InspectionModal
//         open={isInspectionModalOpen}
//         onOpenChange={setIsInspectionModalOpen}
//         onInspectionCompleted={fetchInspections}
//       />
//       {/* Certificate Modal */}
//       <CertificateModal
//         open={isCertificateModalOpen}
//         onOpenChange={setIsCertificateModalOpen}
//         onCertificateIssued={fetchCertificates}
//       />
//     </div>
//   );
// };

// export default QADashboard;
