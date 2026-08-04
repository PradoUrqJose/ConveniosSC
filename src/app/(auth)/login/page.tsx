import { LoginForm } from "./form-login";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;
  return <LoginForm volver={volver} />;
}
