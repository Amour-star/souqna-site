import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/lib/auth/AuthContext';
import {LoadingState} from '@/components/ui';

/** Clears the session (and any cached private data) and returns home. */
const LogoutPage = () => {
  const {logout} = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    void (async () => {
      await logout();
      queryClient.clear();
      navigate('/', {replace: true});
    })();
  }, [logout, navigate, queryClient]);

  return <LoadingState />;
};

export default LogoutPage;
