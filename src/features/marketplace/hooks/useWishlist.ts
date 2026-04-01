import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: likes = [], isLoading } = useQuery({
    queryKey: ["my-likes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("likes")
        .select("product_id")
        .eq("user_id", user.id);
      return data?.map((l) => l.product_id) ?? [];
    },
    enabled: !!user,
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) {
        toast.error("Please sign in to save items to your wishlist");
        navigate("/auth");
        return;
      }

      const isCurrentlyLiked = likes.includes(productId);
      
      if (isCurrentlyLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ user_id: user.id, product_id: productId });
        if (error) throw error;
      }
    },
    onMutate: async (productId) => {
      if (!user) return;

      // 1. Snapshot the previous values
      const previousLikes = queryClient.getQueryData<string[]>(["my-likes", user.id]) || [];
      const isCurrentlyLiked = previousLikes.includes(productId);

      // 2. Feedback to user INSTANTLY (before any awaits)
      if (isCurrentlyLiked) {
        toast.success("Removed from wishlist");
      } else {
        toast.success("Added to wishlist");
      }

      // 3. Optimistically update the caches INSTANTLY
      queryClient.setQueryData(["my-likes", user.id], 
        isCurrentlyLiked 
          ? previousLikes.filter(id => id !== productId)
          : [...previousLikes, productId]
      );

      // Update single-item indicators
      queryClient.setQueryData(["is-liked", productId, user.id], !isCurrentlyLiked);
      queryClient.setQueryData(["like-count", productId], (old: number = 0) => 
        Math.max(0, old + (isCurrentlyLiked ? -1 : 1))
      );

      // Update lists
      const updateProductStats = (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any[]) =>
            page.map((p: any) =>
              p.id === productId
                ? { ...p, likes_count: Math.max(0, (p.likes_count || 0) + (isCurrentlyLiked ? -1 : 1)) }
                : p
            )
          )
        };
      };

      queryClient.setQueriesData({ queryKey: ["products"] }, updateProductStats);
      queryClient.setQueriesData({ queryKey: ["search-products"] }, updateProductStats);

      // 4. Cancel outgoing refetches in the background (using Promise.all for speed)
      // We await these AFTER the UI has already been updated optimistically
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["my-likes", user.id] }),
        queryClient.cancelQueries({ queryKey: ["products"] }),
        queryClient.cancelQueries({ queryKey: ["search-products"] }),
        queryClient.cancelQueries({ queryKey: ["is-liked", productId, user.id] }),
        queryClient.cancelQueries({ queryKey: ["like-count", productId] }),
      ]);

      return { previousLikes };
    },
    onError: (err, productId, context) => {
      if (context?.previousLikes && user) {
        queryClient.setQueryData(["my-likes", user.id], context.previousLikes);
      }
      toast.error("Could not update wishlist. Please try again.");
    },
    onSettled: (data, error, productId) => {
      // Always refetch after error or success to keep server in sync
      queryClient.invalidateQueries({ queryKey: ["my-likes", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["is-liked", productId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["like-count", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["search-products"] });
    },
  });

  return {
    likes,
    isLoading,
    toggleLike: toggleLikeMutation.mutate,
    isToggling: toggleLikeMutation.isPending,
  };
}
