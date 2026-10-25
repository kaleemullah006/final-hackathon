import LookupPage from "@/components/LookupPage";

export default function DesignationsPage() {
  return (
    <LookupPage
      title="Designations"
      subtitle="Job titles. Inactive designations cannot be chosen for new employees."
      path="/designations"
      listKey="designations"
      noun="designation"
    />
  );
}
