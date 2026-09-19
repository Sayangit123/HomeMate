import { create } from "zustand";

interface CartStore {
    selectedCartItemId: string | null;

    setSelectedCartItemId: (
        cartItemId: string | null
    ) => void;

    clearSelectedCartItem: () => void;
}

export const useCartStore =
    create<CartStore>((set) => ({
        selectedCartItemId: null,

        setSelectedCartItemId: (cartItemId) =>
            set({
                selectedCartItemId: cartItemId,
            }),

        clearSelectedCartItem: () =>
            set({
                selectedCartItemId: null,
            }),
    }));