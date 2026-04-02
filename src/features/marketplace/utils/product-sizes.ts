export const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
export const SHOE_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];

export const FOOTWEAR_KEYWORDS = ["shoe", "footwear", "sneaker", "boot", "sandal", "heel", "slipper"];
export const CLOTHING_KEYWORDS = ["clothing", "shirt", "pant", "dress", "fashion", "jean", "top", "wear", "hoodie", "jacket", "short"];

export function getAvailableSizes(categoryName: string): string[] | null {
  if (!categoryName) return CLOTHING_SIZES; // Default to clothing sizes if no category selected yet

  const lowerCategory = categoryName.toLowerCase();
  
  if (FOOTWEAR_KEYWORDS.some(keyword => lowerCategory.includes(keyword))) {
    return SHOE_SIZES;
  }
  
  if (CLOTHING_KEYWORDS.some(keyword => lowerCategory.includes(keyword))) {
    return CLOTHING_SIZES;
  }

  // If it doesn't match either, default to clothing sizes for now as per current behavior,
  // or return null if we want to hide it.
  // The user said "should be sizes specifications just like the clothing", 
  // implying clothing always has them.
  return CLOTHING_SIZES;
}
