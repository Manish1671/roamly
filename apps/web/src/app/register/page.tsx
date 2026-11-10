import { AppShell } from '@/components/app-shell';
import { RegisterForm } from '@/components/auth-form';

export default function RegisterPage() {
  return (
    <AppShell>
      <div className="flex flex-1 items-center py-8">
        <RegisterForm />
      </div>
    </AppShell>
  );
}
