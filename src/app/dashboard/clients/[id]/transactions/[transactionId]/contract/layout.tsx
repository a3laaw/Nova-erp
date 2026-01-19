export default function ContractLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 sm:p-8">
        <main>{children}</main>
    </div>
  );
}
