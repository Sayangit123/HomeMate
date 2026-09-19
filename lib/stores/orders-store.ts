import { create } from "zustand";

interface OrdersStore {
    selectedOrderId: string | null;

    setSelectedOrderId: (
        orderId: string | null
    ) => void;

    clearSelectedOrder: () => void;
}

export const useOrdersStore =
    create<OrdersStore>((set) => ({
        selectedOrderId: null,

        setSelectedOrderId: (orderId) =>
            set({
                selectedOrderId: orderId,
            }),

        clearSelectedOrder: () =>
            set({
                selectedOrderId: null,
            }),
    }));