import { AppShell } from '@/components/app-shell';
import { LoginForm } from '@/components/auth-form';

export default function LoginPage() {
  return (
    <AppShell>
      <div className="flex flex-1 items-center py-8">
        <LoginForm />
      </div>
    </AppShell>
  );
}
