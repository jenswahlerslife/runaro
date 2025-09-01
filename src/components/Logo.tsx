import { Link } from "react-router-dom";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" aria-label="Go to homepage" className={`inline-flex items-center ${className}`}>
      <img src="/logo.svg" alt="Runaro" className="h-10 w-auto" />
    </Link>
  );
}