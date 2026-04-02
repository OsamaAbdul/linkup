import { m } from "framer-motion";

interface ProductDescriptionProps {
  description: string | null;
  animationProps: any;
}

export function ProductDescription({ description, animationProps }: ProductDescriptionProps) {
  return (
    <m.div {...animationProps} transition={{ delay: 0.3 }} className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-xl font-bold">About this item</h3>
        <p className="text-muted-foreground leading-relaxed text-lg">
          {description || "No description available."}
        </p>
      </div>
    </m.div>
  );
}
