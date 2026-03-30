UPDATE public.profiles 
SET avatar_url = NULL 
WHERE avatar_url LIKE '%/storage/v1/object/public/kyc-documents/%';
