'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginBody, PublicUser, RegisterBody } from '@roamly/shared';
import { authApi, fetchCsrfToken } from '@/lib/api-client';

export function useAuth() {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    retry: false,
    staleTime: 60_000,
  });

  const registerMutation = useMutation({
    mutationFn: async (body: RegisterBody) => {
      const csrfToken = await fetchCsrfToken();
      return authApi.register(body, csrfToken);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (body: LoginBody) => {
      const csrfToken = await fetchCsrfToken();
      return authApi.login(body, csrfToken);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await fetchCsrfToken();
      await authApi.logout(csrfToken);
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
    },
  });

  const user: PublicUser | null | undefined = meQuery.data?.user ?? (meQuery.data === null ? null : undefined);

  return {
    user,
    isLoading: meQuery.isLoading,
    isAuthenticated: Boolean(user),
    register: registerMutation,
    login: loginMutation,
    logout: logoutMutation,
    refetch: meQuery.refetch,
  };
}
