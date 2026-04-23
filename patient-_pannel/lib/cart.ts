// Shopping cart utilities using localStorage

export interface CartItem {
  productId: string;
  medicineName: string;
  composition: string;
  brandName?: string;
  category?: string;
  quantity: number;
  price: number;
  mrp?: number;
  discount?: number;
  imageUrl?: string;
  pharmacyId: string;
  pharmacyName?: string;
  prescriptionRequired?: boolean;
  availableQuantity: number;
}

const CART_STORAGE_KEY = "medical_store_cart";

export const cartUtils = {
  // Get all items from cart
  getCart(): CartItem[] {
    if (typeof window === "undefined") return [];
    try {
      const cartJson = localStorage.getItem(CART_STORAGE_KEY);
      return cartJson ? JSON.parse(cartJson) : [];
    } catch {
      return [];
    }
  },

  // Add item to cart or update quantity
  addToCart(item: CartItem): void {
    const cart = this.getCart();
    const existingIndex = cart.findIndex(
      (cartItem) => cartItem.productId === item.productId && cartItem.pharmacyId === item.pharmacyId
    );

    if (existingIndex >= 0) {
      // Update quantity
      cart[existingIndex].quantity += item.quantity;
      // Don't exceed available quantity
      if (cart[existingIndex].quantity > cart[existingIndex].availableQuantity) {
        cart[existingIndex].quantity = cart[existingIndex].availableQuantity;
      }
    } else {
      cart.push(item);
    }

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    this.notifyCartUpdate();
  },

  // Update item quantity
  updateQuantity(productId: string, pharmacyId: string, quantity: number): void {
    const cart = this.getCart();
    const index = cart.findIndex(
      (item) => item.productId === productId && item.pharmacyId === pharmacyId
    );

    if (index >= 0) {
      if (quantity <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index].quantity = Math.min(quantity, cart[index].availableQuantity);
      }
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      this.notifyCartUpdate();
    }
  },

  // Remove item from cart
  removeFromCart(productId: string, pharmacyId: string): void {
    const cart = this.getCart();
    const filtered = cart.filter(
      (item) => !(item.productId === productId && item.pharmacyId === pharmacyId)
    );
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(filtered));
    this.notifyCartUpdate();
  },

  // Clear entire cart
  clearCart(): void {
    localStorage.removeItem(CART_STORAGE_KEY);
    this.notifyCartUpdate();
  },

  // Get cart count
  getCartCount(): number {
    const cart = this.getCart();
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  },

  // Get cart total
  getCartTotal(): number {
    const cart = this.getCart();
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  // Check if item is in cart
  isInCart(productId: string, pharmacyId: string): boolean {
    const cart = this.getCart();
    return cart.some((item) => item.productId === productId && item.pharmacyId === pharmacyId);
  },

  // Get cart items grouped by pharmacy
  getCartByPharmacy(): Record<string, CartItem[]> {
    const cart = this.getCart();
    const grouped: Record<string, CartItem[]> = {};
    cart.forEach((item) => {
      if (!grouped[item.pharmacyId]) {
        grouped[item.pharmacyId] = [];
      }
      grouped[item.pharmacyId].push(item);
    });
    return grouped;
  },

  // Notify cart update (dispatch custom event for reactivity)
  notifyCartUpdate(): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cartUpdated"));
    }
  },
};

