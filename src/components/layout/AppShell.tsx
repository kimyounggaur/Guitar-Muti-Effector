import { ReactNode } from 'react';

type AppShellProps = {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};

function AppShell({ header, footer, children }: AppShellProps) {
  return (
    <div className="app-shell">
      {header}
      <main className="app-main">{children}</main>
      {footer}
    </div>
  );
}

export default AppShell;
