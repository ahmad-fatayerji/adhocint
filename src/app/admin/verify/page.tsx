import VerifyForm from "./VerifyForm";

export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string }>;
}) {
  const sp = (await searchParams) || {};
  const email = typeof sp.email === "string" ? sp.email : "";

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-lg">
        <h1 className="text-3xl font-bold">Verification</h1>
        <p className="mt-2 text-sm text-black/70">
          Enter the 6-digit code sent to{" "}
          <span className="font-semibold">{email || "your email"}</span>.
        </p>

        <VerifyForm email={email} />
      </div>
    </main>
  );
}
