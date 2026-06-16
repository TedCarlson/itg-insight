import FieldLogSubnav from "@/features/field-log/components/FieldLogSubnav";

export default function FieldLogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <FieldLogSubnav />
      {children}
    </div>
  );
}
