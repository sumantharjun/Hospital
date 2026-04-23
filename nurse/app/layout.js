import "./globals.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const metadata = { title: "Nurse Panel - HSP", description: "Nurse management and timesheet system" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="nurse-app">
        {children}
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      </body>
    </html>
  );
}
