# How to set up Google Sign-in for Linkup Marketplace

To enable "Sign in with Google" on your Supabase instance, follow these steps:

## 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Linkup Marketplace`.
3. Go to **APIs & Services** > **OAuth consent screen**.
4. Choose **External** and provide the necessary app details (App name, support email, developer contact).
5. Add the scope `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
6. Publish your app (move it from Testing to Production) once you are ready.

## 2. Create OAuth Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Set **Application type** to **Web application**.
4. Add **Authorized redirect URIs**:
   - You can find this in your [Supabase Dashboard](https://supabase.com/dashboard) under **Authentication** > **Providers** > **Google**. It looks like `https://ujitghpoyqghkjsdfgh.supabase.co/auth/v1/callback`.
5. Click **Create** and copy your **Client ID** and **Client Secret**.

## 3. Configure Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication** > **Providers**.
3. Find **Google** and toggle it **On**.
4. Paste your **Client ID** and **Client Secret**.
5. Save the changes.

## 4. Test the implementation
1. Go to your local app (e.g., `http://localhost:8080/auth`).
2. Click the new **Sign in with Google** button.
3. You should be redirected to Google and then back to Linkup with a successful session.

> [!NOTE]
> Since we already have a profile creation trigger in Postgres, new Google users will have their profiles automatically created upon first login!
