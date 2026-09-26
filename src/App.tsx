import { AuthProvider } from './context/AuthContext';
import { CivicMap } from './pages/CivicMap';

export default function App() {
  return (
    <AuthProvider>
      <CivicMap />
    </AuthProvider>
  );
}
