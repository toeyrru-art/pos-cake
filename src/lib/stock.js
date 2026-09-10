import { supabase } from "./supabase";

/**
 * Deduct stock from products table
 * @param {Array<{ productId?: string, product_id?: string, quantity: number }>} items 
 */
export async function deductStock(items) {
  if (!items || items.length === 0) return;

  const quantitiesByProduct = {};
  items.forEach(item => {
    const pId = item.productId || item.product_id;
    if (pId) {
      quantitiesByProduct[pId] = (quantitiesByProduct[pId] || 0) + (Number(item.quantity) || 0);
    }
  });

  for (const [productId, qty] of Object.entries(quantitiesByProduct)) {
    try {
      const { data: p } = await supabase
        .from("products")
        .select("preorder_limit")
        .eq("id", productId)
        .single();

      if (p && p.preorder_limit !== null && p.preorder_limit !== undefined) {
        const newLimit = Math.max(0, p.preorder_limit - qty);
        await supabase
          .from("products")
          .update({ preorder_limit: newLimit })
          .eq("id", productId);
      }
    } catch (e) {
      console.error("Failed to deduct stock for product", productId, e);
    }
  }
}

/**
 * Restore stock to products table
 * @param {Array<{ productId?: string, product_id?: string, quantity: number }>} items 
 */
export async function restoreStock(items) {
  if (!items || items.length === 0) return;

  const quantitiesByProduct = {};
  items.forEach(item => {
    const pId = item.productId || item.product_id;
    if (pId) {
      quantitiesByProduct[pId] = (quantitiesByProduct[pId] || 0) + (Number(item.quantity) || 0);
    }
  });

  for (const [productId, qty] of Object.entries(quantitiesByProduct)) {
    try {
      const { data: p } = await supabase
        .from("products")
        .select("preorder_limit")
        .eq("id", productId)
        .single();

      if (p && p.preorder_limit !== null && p.preorder_limit !== undefined) {
        const newLimit = p.preorder_limit + qty;
        await supabase
          .from("products")
          .update({ preorder_limit: newLimit })
          .eq("id", productId);
      }
    } catch (e) {
      console.error("Failed to restore stock for product", productId, e);
    }
  }
}
