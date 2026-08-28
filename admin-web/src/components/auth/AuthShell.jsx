import adminLogo from "../../assets/BT_Logo.png";

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgba(14,90,58,0.1)] px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl border border-[#b8e3d2] bg-white px-6 py-8 shadow-sm md:px-8 md:py-10">
        <div className="mb-7 flex flex-col items-center text-center">
          <img
            src={adminLogo}
            alt="Bawat Tala"
            className="mb-4 h-20 w-20 object-contain"
          />
          <h1 className="font-display text-4xl leading-tight text-admin-ink">{title}</h1>
          <p className="mt-2 text-sm text-admin-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
