import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const email = "admin@linkup.com";
  const password = "Admin@12345";

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingAdmin = existingUsers?.users?.find(u => u.email === email);

  if (existingAdmin) {
    // Ensure admin role exists
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", existingAdmin.id)
      .eq("role", "admin");

    if (!roles?.length) {
      await supabase.from("user_roles").insert({ user_id: existingAdmin.id, role: "admin" });
    }

    return new Response(JSON.stringify({ message: "Admin already exists", email, password }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create admin user
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Admin" }
  });

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), { status: 400 });
  }

  // Add admin role
  await supabase.from("user_roles").insert({ user_id: newUser.user.id, role: "admin" });

  return new Response(JSON.stringify({ message: "Admin created", email, password }), {
    headers: { "Content-Type": "application/json" },
  });
});
