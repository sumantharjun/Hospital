import ReceptionLayout from "../components/ReceptionLayout";

export default function ReceptionRootLayout({ children }) {
  return (
    <ReceptionLayout>
      <div className="gov-page">{children}</div>
    </ReceptionLayout>
  );
}
