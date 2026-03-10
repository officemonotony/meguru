import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/app/context/AuthContext';
import { DataProvider } from '@/app/context/DataContext';
import { LoginScreen } from '@/app/components/LoginScreen';
import { RestaurantDashboard } from '@/app/components/RestaurantDashboard';
import { FarmerDashboard } from '@/app/components/FarmerDashboard';
import { AdminDashboard } from '@/app/components/AdminDashboard';
import { Loader2 } from 'lucide-react';

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#000',
              color: '#fff',
              borderRadius: '16px',
              padding: '16px 20px',
              fontSize: '14px',
              fontWeight: 600,
            },
            classNames: {
              description: 'text-gray-300 text-xs',
              success: '!bg-black !text-white',
              error: '!bg-red-600 !text-white',
            },
          }}
        />
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginScreen />;
  }

  if (profile.role === 'farmer') {
    return <FarmerDashboard onLogout={signOut} />;
  }

  if (profile.role === 'restaurant') {
    return <RestaurantDashboard onLogout={signOut} />;
  }

  if (profile.role === 'admin') {
    return <AdminDashboard onLogout={signOut} />;
  }

  return null;
}
