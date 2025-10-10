export async function load({ parent }) {
  const { session } = await parent();
  const user = session?.user ?? null;
  return { user };
}
