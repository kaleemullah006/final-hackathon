import LookupPage from "@/components/LookupPage";

export default function DepartmentsPage() {
  return (
    <LookupPage
      title="Departments"
      subtitle="Teams that employees belong to. Inactive departments cannot be chosen for new employees."
      path="/departments"
      listKey="departments"
      noun="department"
    />
  );
}
